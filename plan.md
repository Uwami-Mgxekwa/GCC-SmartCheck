
## 🧩 GCC SmartCheck — Front‑End System Plan

### 1. **Core Concept**
A static web app where:
- Students register themselves (name, surname, ID/passport/DOB).  
- The system generates a **unique QR code** for each student.  
- The lecturer logs in, selects a module, and uses the device camera to **scan student QR codes** to mark attendance.  
- All data is stored locally (browser storage or JSON files) since GitHub Pages can’t host a database.

---

### 2. **File Structure**
```
/gcc-smartcheck/
│
├── index.html          → Landing page (login/register)
├── register.html       → Student registration form
├── dashboard.html      → Lecturer dashboard (module selection)
├── scan.html           → QR scanning interface
├── style.css           → Global styles
├── script.js           → Core logic (QR generation, scanning, storage)
├── data/
│   └── students.json   → Optional static student list (for testing)
└── assets/
    └── logo.png        → GCC SmartCheck logo
```

---

### 3. **Functional Flow**
#### 🧑‍🎓 Student Registration
- Form fields:  
  - Name  
  - Surname  
  - ID Number / Passport Number / DOB  
- Logic:
  - Generate a **unique student ID** using a hash of name + surname + ID/DOB.  
  - Create a **QR code** containing that unique ID.  
  - Save student data in `localStorage` or export to JSON.  
  - Display QR code for download or printing.

#### 👩‍🏫 Lecturer Login & Module Selection
- Simple password‑protected login (hardcoded or localStorage‑based).  
- After login, lecturer selects:
  - Course  
  - Module  
  - Date/session  

#### 📷 QR Scanning
- Use `html5-qrcode` or `instascan.js` library.  
- When a QR code is scanned:
  - Extract student ID.  
  - Match against stored student list.  
  - Mark attendance for that session in localStorage.  
  - Display confirmation (“✅ Owami Mgxekwa marked present”).

#### 📊 Attendance Summary
- Show a table of students with present/absent status.  
- Allow export to CSV or print view.

---

### 4. **Data Storage Strategy**
Since GitHub Pages is static:
- Use **localStorage** for temporary data.  
- Optionally, allow **manual export/import** of JSON files for persistence.  
- Example structure:
```json
{
  "students": [
    {"id":"gcc12345","name":"Owami","surname":"Mgxekwa","identifier":"6305722080"},
    {"id":"gcc67890","name":"Lerato","surname":"Mokoena","identifier":"2001-05-12"}
  ],
  "attendance": {
    "module":"Cybersecurity",
    "date":"2026-05-24",
    "records":["gcc12345","gcc67890"]
  }
}
```

---

### 5. **UI Design**
- **Minimalist layout** (white background, blue/green accents matching logo).  
- **Pages:**
  - Registration form with QR preview.  
  - Lecturer dashboard with dropdowns for course/module.  
  - Scanning page with camera feed and live attendance list.  
- **Animations:** subtle fade‑ins and button hover transitions.

---

### 6. **Libraries to Include**
- `html5-qrcode` → for scanning  
- `qrcode.js` → for generating student QR codes  
- `FileSaver.js` → for exporting attendance JSON/CSV  
- `Bootstrap` or `TailwindCSS` → optional for responsive design

---

### 7. **Security Notes**
- Keep lecturer login simple (localStorage‑based).  
- Avoid storing sensitive data online.  
- Use hashed IDs for foreign students (e.g., `gcc-<timestamp>-<random>`).

---

### 8. **Next Steps**
1. Build registration page and test QR generation.  
2. Implement scanning logic and attendance marking.  
3. Add dashboard summary and export feature.  
4. Polish UI with GCC SmartCheck branding.
