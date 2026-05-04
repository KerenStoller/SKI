import os
import json
from typing import Dict, Any
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

with open(os.path.join(os.path.dirname(__file__), 'prompt.md'), 'r') as f:
    PROMPT_TEMPLATE = f.read()

def build_prompt(rubric: str, student_answer: str) -> str:
    """
    Fill the prompt template with the rubric and student answer.
    """
    prompt = PROMPT_TEMPLATE.replace('[Insert rubric here]', rubric)
    prompt = prompt.replace('[Insert student answer here]', student_answer)
    return prompt

def grade_answer(rubric: str, student_answer: str) -> Dict[str, Any]:
    # Call OpenAI API with actual grading logic
    prompt = build_prompt(rubric, student_answer)
    
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=512,
        temperature=0.2,
    )
    
    # Expecting a JSON string in the response
    try:
        result = json.loads(response.choices[0].message.content)
    except Exception as e:
        result = {"error": str(e), "raw": response.choices[0].message.content}
    return result
