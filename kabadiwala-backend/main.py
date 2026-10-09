from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables (Make sure to create a .env file here too!)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qtfbswcsqxnutczivlua.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_GUGc9c5oxwW5LKzOs5JaFA_pJZi_CwK")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Kabadiwala Connect API", description="Background API for Analytics and Machine Learning")

# Allow the React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Kabadiwala Background Server is running."}

@app.get("/analytics/summary")
def get_analytics_summary():
    """
    Example endpoint: Fetch summary statistics from Supabase
    This is useful for the Admin Dashboard or generating reports.
    """
    try:
      # Fetch count of completed lots
      lots_response = supabase.table("lots").select("*", count="exact").eq("status", "COMPLETED").execute()
      completed_lots = lots_response.count if lots_response.count else 0
      
      # Fetch total recyclers
      recyclers_response = supabase.table("recyclers").select("*", count="exact").execute()
      total_recyclers = recyclers_response.count if recyclers_response.count else 0
      
      return {
          "total_completed_lots": completed_lots,
          "total_registered_recyclers": total_recyclers,
          "status": "success"
      }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def process_heavy_task_in_background(lot_id: str):
    """
    A simulated heavy background task (e.g. running AI model or sending SMS).
    """
    import time
    print(f"Started background processing for lot {lot_id}...")
    time.sleep(5) # Simulate long running process
    print(f"Finished background processing for lot {lot_id}. AI Analysis complete.")

@app.post("/tasks/analyze-lot/{lot_id}")
def trigger_background_analysis(lot_id: str, background_tasks: BackgroundTasks):
    """
    Endpoint that triggers a background process without making the frontend wait.
    """
    background_tasks.add_task(process_heavy_task_in_background, lot_id)
    return {"message": f"Analysis for lot {lot_id} has been queued in the background."}

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
