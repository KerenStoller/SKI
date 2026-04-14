import os
import openai
from typing import Dict, Any

# You can set your OpenAI API key here for development
openai.api_key = os.getenv("OPENAI_API_KEY", "sk-...your-free-key...")

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
    prompt = build_prompt(rubric, student_answer)
    response = openai.ChatCompletion.create(
        model="gpt-4o",  # Use GPT-4o or fallback to gpt-3.5-turbo if needed
        messages=[{"role": "user", "content": prompt}],
        max_tokens=512,
        temperature=0.2,
    )
    # Expecting a JSON string in the response
    import json
    try:
        result = json.loads(response.choices[0].message['content'])
    except Exception as e:
        result = {"error": str(e), "raw": response.choices[0].message['content']}
    return result
