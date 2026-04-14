import os
import time
import base64
import fitz  # PyMuPDF
from dotenv import dotenv_values
from mistralai.client import Mistral

# Configuration
config = dotenv_values(".env")
# Ensure your MISTRAL_API_KEY environment variable is set
API_KEY = config.get("MISTRAL_API_KEY")
PATH_TO_PDF = r"C:\Users\ido\Desktop\מדמח\סמסטר ב שנה ד\סדנה\Doc2.pdf"

def pdf_to_base64_image(pdf_path, page_number=0):
    """Converts a specific page of a PDF to a standard-res base64 encoded image."""
    print("--- Converting PDF page to standard-res image ---")
    
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_number)
    
    # Using Matrix(1, 1) to keep the base64 string size small enough for Free Tier limits
    pix = page.get_pixmap(matrix=fitz.Matrix(1, 1))
    
    img_bytes = pix.tobytes("png")
    base64_encoded = base64.b64encode(img_bytes).decode('utf-8')
    
    doc.close()
    return base64_encoded

def transcribe_bulletproof(pdf_path):
    if not os.path.exists(pdf_path):
        print(f"Error: File not found at {pdf_path}")
        return

    client = Mistral(api_key=API_KEY)
    
    try:
        base64_image = pdf_to_base64_image(pdf_path, page_number=0)
    except Exception as e:
        print(f"Failed to convert PDF to image: {e}")
        return

    print("--- Transcribing via Direct Vision Payload ---")

    # The prompt explicitly guides the model to handle the complex layout
    prompt = """
    You are an expert transcriber. Transcribe the text and code in this image perfectly.
    Follow these rules strictly:
    1. The image contains a mix of typed Hebrew (Right-to-Left) and C code (Left-to-Right). Maintain logical flow.
    2. Pay close attention to the handwritten C code.
    3. IGNORE any text or code that is crossed out or scribbled over.
    4. Carefully read C variable names (e.g., it is 'lst' not '1st', 'Name_len', 'indexF').
    5. Output the result in clean Markdown format.
    6. DO NOT auto-complete or fix broken C code. If the handwriting cuts off at the bottom of the page, end the transcription exactly on the last visible word or symbol. Do not add placeholder comments or closing brackets.
    """
    
    max_retries = 3
    retry_delay = 5  # Start by waiting 5 seconds on a 429 error

    for attempt in range(max_retries):
        try:
            # Using the 12b model to stay under strict token limits
            response = client.chat.complete(
                model="pixtral-12b-2409",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": f"data:image/png;base64,{base64_image}"}
                        ]
                    }
                ]
            )
            
            output_content = response.choices[0].message.content
            output_file = "final_bulletproof_exam.md"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(output_content)
                
            print("--- DONE ---")
            print(f"Output saved to: {output_file}")
            break  # Success! Break out of the retry loop

        except Exception as e:
            error_str = str(e)
            if "429" in error_str:
                print(f"Rate limit hit (429). Waiting {retry_delay} seconds before retry {attempt + 1}/{max_retries}...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Double the wait time for the next attempt (exponential backoff)
            else:
                print(f"An unexpected error occurred: {e}")
                break # Stop retrying if the error is not a rate limit

if __name__ == "__main__":
    if not API_KEY:
        print("Error: Set MISTRAL_API_KEY environment variable.")
    else:
        transcribe_bulletproof(PATH_TO_PDF)