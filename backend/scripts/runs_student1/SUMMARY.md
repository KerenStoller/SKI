# student_1 — what we learned from running it 10 times

**Date:** 2026-05-11

## The short version

The grader is fine. The OCR is the problem. We need to pay for the bigger OCR model.

## What we did

We ran the whole flow on student_1's exam 10 times in a row and looked at how much the final score jumped around.

We also did a second experiment: we read the exam **once**, then asked the grader to grade that same reading 10 times. This way we could tell which part of the system is causing the chaos — the reading, or the grading.

## What we found

When the OCR re-reads the exam every time, the score is all over the place: it ranges from **45 to 100** out of 100. Same student, same exam, totally different grade depending on the run.

When we fix the reading and only re-run the grading, the score barely moves: it stays between **90 and 95**. The grader is consistent.

So the grader is doing its job. The OCR is the one inventing chaos.

## Why the OCR is so bad

It's not just making small spelling mistakes. It's making up entirely different code each time it reads the same page. Some examples:

- Question 1 asks the student to write `isSorted`. On two runs the OCR decided the student wrote `isPalindrome` instead.
- Question 2 asks for a `Team` class. Different runs read it as `StringRepresentation`, `StringReverser`, or `StringReplacement`, with fields the student never wrote.
- Question 3 asks for `TeamManager`. The OCR sometimes returned a class called `Hackathon`.
- Question 4 (a password checker) once came back as a palindrome check.

The grader then looks at these made-up answers and correctly deducts points — "this class is named wrong, deduct 25" — but it's punishing the student for code the OCR invented. The output looks professional and convincing, which is the dangerous part: confident, well-explained, wrong grades.

## What we should do

**Get the subscription for the larger OCR model.** The current one (Pixtral-12B) is too small to reliably read handwritten code, even with the temperature set to 0. A bigger model should hallucinate far less.

If we can't get the subscription right away, the backup plan is to run the OCR 3 times per exam and have it vote on which reading is right — but that costs 3x and is a workaround, not a fix.

## Files in this folder

- `phase_a.json` — the 10 full runs (read + grade each time)
- `phase_b.json` — the 10 grade-only runs (read once, grade 10 times)
- Script that produced these: `backend/scripts/run_flow_x10.py`
