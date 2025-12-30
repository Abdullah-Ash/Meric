/* =========================================
   1. CONFIGURATION & STATE
   ========================================= */
const API_KEY = "AIzaSyCCgJpMsVgWkRheRWQoRJnbEc8pxW7hZQY"; 
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let currentUser = null;
let currentAnalysis = null;
let base64Image = null;

/* =========================================
   2. NAVIGATION & AUTH
   ========================================= */
function handleLogin(e) {
    e.preventDefault();
    currentUser = document.querySelector('input[type="email"]').value.trim();
    if (!currentUser) {
        alert("Please enter your email.");
        return;
    }
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('login').classList.remove('active');
    navigate('home');
    loadProfile();
    loadHistory();
    loadSaved();
}

function logout() {
    currentUser = null;
    location.reload();
}

function navigate(pageId) {
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
    });
    const targetPage = document.getElementById(pageId);
    if(targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('active');
    }

    if(pageId === 'history') loadHistory();
    if(pageId === 'saved') loadSaved();
}

function switchTab(mode, event) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(event) event.target.classList.add('active');
    document.getElementById('upload-mode').classList.add('hidden');
    document.getElementById('text-mode').classList.add('hidden');
    document.getElementById(`${mode}-mode`).classList.remove('hidden');
}

/* =========================================
   3. AI LOGIC
   ========================================= */
function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        base64Image = e.target.result.split(',')[1];
        const img = document.getElementById('imagePreview');
        img.src = e.target.result;
        img.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

async function analyzeMedicine() {
    if (!currentUser) {
        alert("Please login first.");
        return;
    }

    const loader = document.getElementById('loader');
    const resultArea = document.getElementById('result-area');
    const manualName = document.getElementById('manualInput').value.trim();
    
    if (!base64Image && !manualName) {
        alert("Please upload an image or type a medicine name.");
        return;
    }

    const profileKey = `medProfile_${currentUser}`;
    const profile = JSON.parse(localStorage.getItem(profileKey)) || {};
    
    const prompt = `Identify this medicine ${manualName ? `named "${manualName}"` : ""}. 
Return ONLY a JSON object: {"name": "Name", "common_uses": [], "dosage": "", "warnings": [], "side_effects": []}
Context: Age ${profile.age || 'N/A'}, Gender: ${profile.gender || 'N/A'}, Allergies: ${profile.allergies || 'None'}.`;

    let payload = { contents: [{ parts: [{ text: prompt }] }] };
    if (base64Image) {
        payload.contents[0].parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Image } });
    }

    loader.classList.remove('hidden');
    try {
        const resp = await fetch(API_URL, { 
            method: "POST", 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        const data = await resp.json();
        const rawJson = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        const med = JSON.parse(rawJson);
        
        currentAnalysis = med; 
        renderMedicineUI(med); 
        addToHistory(med.name, new Date().toLocaleString());
        
        resultArea.classList.remove('hidden');
        resultArea.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert("AI Error. Please try again.");
        console.error(err);
    } finally {
        loader.classList.add('hidden');
    }
}

/* =========================================
   4. DATA FEATURES (USER-ISOLATED)
   ========================================= */
function saveResult(event) {
    if (!currentAnalysis || !currentUser) return;

    const savedKey = `medSaved_${currentUser}`;
    let saved = JSON.parse(localStorage.getItem(savedKey)) || [];
    const newItem = {
        data: JSON.parse(JSON.stringify(currentAnalysis)),
        date: new Date().toLocaleString()
    };
    
    saved.unshift(newItem);
    localStorage.setItem(savedKey, JSON.stringify(saved));

    const btn = event.target.closest('button');
    if (btn) {
        btn.innerHTML = 'Saved!';
        setTimeout(() => btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save', 2000);
    }
}

function loadSaved() {
    if (!currentUser) return;
    const list = document.getElementById('saved-list');
    const savedKey = `medSaved_${currentUser}`;
    let saved = JSON.parse(localStorage.getItem(savedKey)) || [];

    if (saved.length === 0) {
        list.innerHTML = '<p>No saved items.</p>';
        return;
    }

    let html = `<button onclick="clearSaved()" style="margin-bottom:15px; background:#ef4444; width:auto; padding:8px 15px;">Clear All Saved</button>`;
    html += saved.map((item, index) => {
        if (!item || !item.data || !item.data.name) return '';
        return `
            <div class="list-item" onclick="viewSavedDetail(${index})" style="padding:15px; border:1px solid #ccc; margin-bottom:10px; cursor:pointer; background:white; color:black; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${item.data.name}</strong><br>
                    <small>${item.date}</small>
                </div>
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
    }).join('');

    list.innerHTML = html;
}

function clearSaved() {
    if (!currentUser) return;
    if(confirm("Wipe all saved data for your account?")) {
        const savedKey = `medSaved_${currentUser}`;
        localStorage.removeItem(savedKey);
        loadSaved();
    }
}

function viewSavedDetail(index) {
    if (!currentUser) return;
    const savedKey = `medSaved_${currentUser}`;
    const saved = JSON.parse(localStorage.getItem(savedKey)) || [];
    const item = saved[index];
    if(!item || !item.data) return;

    currentAnalysis = item.data;
    renderMedicineUI(item.data);
    navigate('identify');
}

function renderMedicineUI(med) {
    const outputDiv = document.getElementById('ai-content');
    outputDiv.innerHTML = `
        <div class="result-card">
            <div class="result-header-blue">
                <h2>${med.name}</h2>
            </div>
            <div class="result-body">
                <div class="result-section">
                    <h4>Uses</h4>
                    <ul>${med.common_uses.map(u => `<li>${u}</li>`).join('')}</ul>
                    <h4 style="margin-top:20px">Dosage</h4>
                    <div class="dosage-box">${med.dosage}</div>
                </div>
                <div class="result-section">
                    <h4>Warnings</h4>
                    <div class="warning-box">${med.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('')}</div>
                    <h4 style="margin-top:20px">Side Effects</h4>
                    <div class="tag-container">${med.side_effects.map(s => `<span class="pill-tag">${s}</span>`).join('')}</div>
                </div>
            </div>
        </div>`;
    document.getElementById('result-area').classList.remove('hidden');
}

/* =========================================
   5. UTILS
   ========================================= */
function addToHistory(title, date) {
    if (!currentUser) return;
    const historyKey = `medHistory_${currentUser}`;
    let history = JSON.parse(localStorage.getItem(historyKey)) || [];
    history.unshift({ title, date });
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 10)));
}

function loadHistory() {
    if (!currentUser) return;
    const list = document.getElementById('history-list');
    const historyKey = `medHistory_${currentUser}`;
    const history = JSON.parse(localStorage.getItem(historyKey)) || [];
    list.innerHTML = history.map(item => `<div class="list-item">${item.title} - ${item.date}</div>`).join('');
}

function saveProfile(e) {
    e.preventDefault();
    if (!currentUser) return;

    const profile = {
        age: document.getElementById('p-age').value,
        gender: document.getElementById('p-gender').value,
        allergies: document.getElementById('p-allergies').value,
        conditions: document.getElementById('p-conditions').value
    };
    const profileKey = `medProfile_${currentUser}`;
    localStorage.setItem(profileKey, JSON.stringify(profile));
    alert("Profile Saved");
}

function loadProfile() {
    if (!currentUser) return;
    const profileKey = `medProfile_${currentUser}`;
    const profile = JSON.parse(localStorage.getItem(profileKey)) || {};
    document.getElementById('p-age').value = profile.age || '';
    document.getElementById('p-gender').value = profile.gender || '';
    document.getElementById('p-allergies').value = profile.allergies || '';
    document.getElementById('p-conditions').value = profile.conditions || '';
}

function speakText() {
    if (!currentAnalysis) return;
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(`${currentAnalysis.name}...... Uses ...... ${currentAnalysis.common_uses}...... Warnings ...... ${currentAnalysis.warnings}....... Dosage .......  ${currentAnalysis.dosage}....... Side Effects .......  ${currentAnalysis.side_effects}`);

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name === 'Google US English') 
                        || voices.find(v => v.name.includes('Google'))
                        || voices[0];

    if (preferredVoice) {
        u.voice = preferredVoice;
        u.lang = preferredVoice.lang;
    }

    u.rate = 0.9;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
}

/* =========================================
   6. UPTIME COUNTER
   ========================================= */
const startDate = new Date("2025-01-01T00:00:00");
setInterval(() => {
    const diff = new Date() - startDate;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff / 3600000) % 24);
    const mins = Math.floor((diff / 60000) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    const counterEl = document.getElementById('uptime-counter');
    if(counterEl) counterEl.innerHTML = `${days}d : ${hours}h : ${mins}m : ${secs}s`;
}, 1000);