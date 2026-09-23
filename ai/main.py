from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('GEMINI_API_KEY')

models = ["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemma-4-26b","gemma-4-31b"]
models_high = ["gemini-3.8-flash","gemini-3.5-flash","gemini-3.6-flash","gemini-3.7-flash"]

llm = ChatGoogleGenerativeAI(
    model = models_high[0],
    temperature=0.7,
    google_api_key = api_key
)

prompt = "Suggest me a skill that is in demand?"
for chunk in llm.stream(prompt):
    print(chunk.content, end="", flush=True)