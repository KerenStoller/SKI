import os
import base64
import json
import fitz  # PyMuPDF
from dotenv import dotenv_values
from mistralai.client import Mistral

# --- Configuration ---
config = dotenv_values(".env")
API_KEY = config.get("MISTRAL_API_KEY")
MODEL = "pixtral-12b-2409"

# Update these to your actual file names
PATH_TO_CLEAN_PDF = "CS_Bagrut_Simulation-v2.pdf"
PATH_TO_ANSWERED_PDF = "CS_Bagrut_Answered_No_Grade.pdf"
OUTPUT_DIR = "extracted_student_work"

def get_payload(clean_path, answered_path):
    # 1. Template context
    clean_doc = fitz.open(clean_path)
    template_text = ""
    for page in clean_doc:
        template_text += f"--- Page {page.number + 1} ---\n{page.get_text()}\n"
    clean_doc.close()

    # 2. Build instructions
    # We add a "Chain of Thought" requirement to stop it from skipping lines.
    content_list = [
        {
            "type": "text", 
            "text": f"You are a forensic OCR specialist. You must transcribe the handwritten answers from the attached images.\n\n"
                    f"CRITICAL RULES TO PREVENT SKIPPING:\n"
                    f"1. Read every single line of handwriting from top to bottom.\n"
                    f"2. If you see a line of code, transcribe it. Do not skip to the next function.\n"
                    f"3. If the student wrote Hebrew, maintain the RTL flow.\n"
                    f"4. Transcribe EXACTLY what is written, including mistakes and messy symbols.\n\n"
                    f"TEMPLATE FOR MAPPING:\n{template_text}"
        }
    ]

    # 3. Add Images
    answered_doc = fitz.open(answered_path)
    for i in range(len(answered_doc)):
        page = answered_doc.load_page(i)
        # 3.0 scale is very high-res, but necessary for complex code
        pix = page.get_pixmap(matrix=fitz.Matrix(3, 3)) 
        img_bytes = pix.tobytes("png")
        base64_img = base64.b64encode(img_bytes).decode('utf-8')
        
        content_list.append({
            "type": "image_url", 
            "image_url": f"data:image/png;base64,{base64_img}"
        })
    
    answered_doc.close()
    return content_list

def save_output(json_response):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    try:
        data = json.loads(json_response)
        
        # Save master JSON
        with open(f"{OUTPUT_DIR}/master_data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        # Iterate through answers
        answers = data.get("answers", {})
        for q_key, q_val in answers.items():
            # If the value is a dictionary (multiple parts), iterate through parts
            if isinstance(q_val, dict):
                for part_name, text in q_val.items():
                    filename = f"Q_{q_key}_{part_name}.java"
                    with open(f"{OUTPUT_DIR}/{filename}", "w", encoding="utf-8") as f:
                        f.write(str(text))
            else:
                # Direct value
                filename = f"Q_{q_key}.java"
                with open(f"{OUTPUT_DIR}/{filename}", "w", encoding="utf-8") as f:
                    f.write(str(q_val))

        print(f"Extraction complete. Files saved to: {OUTPUT_DIR}")

    except Exception as e:
        print(f"Error processing output: {e}")
        # Save raw output just in case parsing failed
        with open("raw_error_output.txt", "w", encoding="utf-8") as f:
            f.write(json_response)

def run():
    if not API_KEY:
        print("API Key missing.")
        return

    client = Mistral(api_key=API_KEY)
    payload = get_payload(PATH_TO_CLEAN_PDF, PATH_TO_ANSWERED_PDF)

    print("--- Sending High-Res Payload ---")
    try:
        # Increase max_tokens to ensure the code isn't cut off mid-sentence
        response = client.chat.complete(
            model=MODEL,
            messages=[{"role": "user", "content": payload}],
            response_format={"type": "json_object"},
            max_tokens=4000 
        )

        save_output(response.choices[0].message.content)

    except Exception as e:
        print(f"API Error: {e}")

if __name__ == "__main__":
    run()