"""
Run the full grading flow (OCR -> grading) on student1.pdf 10 times.

Goal: see run-to-run variance and attribute it to OCR vs grading.

Plan:
  Phase A — end-to-end x10: fresh OCR + fresh grading each run.
  Phase B — grading-only x10: reuse OCR output from run A1, regrade 10 times.

If Phase B is stable but Phase A varies, OCR is to blame.
If Phase B itself varies a lot, grading is at least co-responsible.
"""
import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.grading.grader import grade_exam
from backend.ocr.extractor import extract_answers

N = 10
EXAMS = ROOT / "test_exams"
EMPTY = (EXAMS / "unanswered.pdf").read_bytes()
SOLVED = (EXAMS / "student1.pdf").read_bytes()
RUBRIC = (EXAMS / "rubric.txt").read_text()

OUT = Path(__file__).parent / "runs_student1"
OUT.mkdir(exist_ok=True)


def summarize_questions(qs):
    """Concise digest of an OCR output for comparison."""
    return [
        {"q": q.get("question_number"), "answer_len": len(q.get("student_answer", "") or "")}
        for q in qs
    ]


def run_phase_a():
    print(f"\n=== Phase A: end-to-end x{N} (fresh OCR + fresh grading) ===")
    rows = []
    for i in range(1, N + 1):
        t0 = time.time()
        try:
            qs = extract_answers(EMPTY, SOLVED)
            grading = grade_exam(RUBRIC, qs)
            elapsed = time.time() - t0
            rows.append({"run": i, "ok": True, "elapsed": elapsed, "ocr": qs, "grading": grading})
            print(f"  A{i:>2}: score={grading['final_score']:>5.1f}  deductions={len(grading.get('deductions', []))}  t={elapsed:.1f}s")
        except Exception as e:
            elapsed = time.time() - t0
            rows.append({"run": i, "ok": False, "elapsed": elapsed, "error": str(e)})
            print(f"  A{i:>2}: FAILED ({e})  t={elapsed:.1f}s")
    (OUT / "phase_a.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False))
    return rows


def run_phase_b(fixed_ocr):
    print(f"\n=== Phase B: grading-only x{N} (OCR fixed to Phase A's first OK run) ===")
    rows = []
    for i in range(1, N + 1):
        t0 = time.time()
        try:
            grading = grade_exam(RUBRIC, fixed_ocr)
            elapsed = time.time() - t0
            rows.append({"run": i, "ok": True, "elapsed": elapsed, "grading": grading})
            print(f"  B{i:>2}: score={grading['final_score']:>5.1f}  deductions={len(grading.get('deductions', []))}  t={elapsed:.1f}s")
        except Exception as e:
            elapsed = time.time() - t0
            rows.append({"run": i, "ok": False, "elapsed": elapsed, "error": str(e)})
            print(f"  B{i:>2}: FAILED ({e})  t={elapsed:.1f}s")
    (OUT / "phase_b.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False))
    return rows


def stats(label, scores):
    if not scores:
        print(f"  {label}: no successful runs")
        return
    mean = statistics.mean(scores)
    stdev = statistics.stdev(scores) if len(scores) > 1 else 0.0
    print(f"  {label}: n={len(scores)} mean={mean:.2f} stdev={stdev:.2f} min={min(scores)} max={max(scores)} range={max(scores) - min(scores)}")


def analyze(phase_a, phase_b):
    print("\n=== Analysis ===")
    a_scores = [r["grading"]["final_score"] for r in phase_a if r["ok"]]
    b_scores = [r["grading"]["final_score"] for r in phase_b if r["ok"]]
    stats("Phase A (end-to-end) scores", a_scores)
    stats("Phase B (grading-only) scores", b_scores)

    # OCR fingerprint variance: how stable is the OCR output text length per question?
    ocr_digests = [summarize_questions(r["ocr"]) for r in phase_a if r["ok"]]
    distinct_digests = {json.dumps(d, sort_keys=True) for d in ocr_digests}
    print(f"  Phase A OCR digests: {len(distinct_digests)} distinct shape(s) across {len(ocr_digests)} runs")

    # Deduction set fingerprint: how stable are the chosen deductions?
    def ded_sig(g):
        return tuple(sorted((d.get("question_number"), round(d.get("points", 0), 2)) for d in g.get("deductions", [])))
    a_sigs = {ded_sig(r["grading"]) for r in phase_a if r["ok"]}
    b_sigs = {ded_sig(r["grading"]) for r in phase_b if r["ok"]}
    print(f"  Phase A distinct deduction signatures: {len(a_sigs)}")
    print(f"  Phase B distinct deduction signatures: {len(b_sigs)}")

    print("\nVerdict heuristic:")
    a_range = (max(a_scores) - min(a_scores)) if a_scores else 0
    b_range = (max(b_scores) - min(b_scores)) if b_scores else 0
    if b_range >= a_range * 0.8:
        print("  Grading alone explains most of the variance -> blame GRADING.")
    elif b_range < a_range * 0.3:
        print("  Grading is stable; variance comes in mainly when OCR is re-run -> blame OCR.")
    else:
        print("  Both contribute. OCR adds noise on top of an already-noisy grader.")


def main():
    phase_a = run_phase_a()
    first_ok = next((r for r in phase_a if r["ok"]), None)
    if first_ok is None:
        print("\nNo successful Phase A runs; skipping Phase B.")
        return
    phase_b = run_phase_b(first_ok["ocr"])
    analyze(phase_a, phase_b)
    print(f"\nResults saved to: {OUT}")


if __name__ == "__main__":
    main()
