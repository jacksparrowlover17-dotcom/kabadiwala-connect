# 08 — Run and Demo Guide

## Prerequisites
- Node.js 18+ installed
- npm 9+ installed
- (For APK) Android Studio with SDK 34+, Java 17+

## 1. Install Dependencies
cd E:\K\kabadiwala-app
npm install

## 2. Configure Environment Variables
Create E:\K\kabadiwala-app\.env with:
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key

Note: The app runs fully offline without Supabase credentials. 
Cloud sync will fail silently but all local features work.

## 3. Run Development Server
cd E:\K\kabadiwala-app
npm run dev

App available at: http://localhost:5173/

## 4. Build Production Bundle
npm run build
Output: E:\K\kabadiwala-app\dist\

## 5. Build Android APK
Step 1: Sync web assets to Android project
  npx cap sync android

Step 2: Open in Android Studio
  npx cap open android

Step 3: In Android Studio:
  Build > Build Bundle(s) / APK(s) > Build APK(s)
  Output: android\app\build\outputs\apk\debug\app-debug.apk

## 6. Run E2E Simulation Scripts (Optional)
node test_e2e_simulation.mjs
node test_hub_workflow.mjs

(These are Node.js scripts. Verify they pass before demo.)

## 7. Verify Database State in Browser
Open browser devtools at http://localhost:5173/
Application tab > Storage > IndexedDB > KabadiwalaConnect
Tables: lots, recyclers, profile, hubs, hubPurchases, payments, shipments

## 8. Reset Demo Data (Fresh Start)
Application tab > IndexedDB > Right-click KabadiwalaConnect > Delete database
Refresh page. Database re-initializes with 45 synthetic lots and demo profiles.

## 9. Key Routes
| Route | Role | Description |
|---|---|---|
| / | COLLECTOR | Home page, lot list, profile |
| /new | COLLECTOR | Create new lot |
| /handover/:id | COLLECTOR | Handover parchi for specific lot |
| /prices | ALL | Price board |
| /safety | COLLECTOR | Safety guide |
| /hub | HUB | Hub operator dashboard |
| /hub/shipments | HUB | Shipment aggregation |
| /recycler | RECYCLER | Recycler gate dashboard |
| /data | ADMIN | Data export and EPR |

## 10. Role Switching
Use the top dropdown (Active Role) to switch between:
- Informal Collector (Kabadiwala) -> navigates to /
- Collection Hub Operator -> navigates to /hub
- Formal Recycler (CPCB) -> navigates to /recycler
- Govt / Administrator -> navigates to /data
