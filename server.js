// --- Archivo: server.js (VERSIÓN CON CORRECCIÓN DE IA) ---
const express = require('express');
const cors = require('cors');
const db = require('./database');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Carga las variables de .env (tu API Key)
require('dotenv').config();

// --- LÍNEA DE DIAGNÓSTICO ---
console.log("🔑 Verificando API Key:", process.env.API_KEY ? "¡Encontrada!" : "¡NO ENCONTRADA! Revisa tu archivo .env");
// --- FIN DE LÍNEA DE DIAGNÓSTICO ---

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de IA ---
let genAI, model;
if (process.env.API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-pro" });
} else {
    console.error("Error: La API_KEY no está configurada. El chat de IA no funcionará.");
}

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- SERVIR FRONTEND ESTATICO ---
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS API (Backend) ---
app.get('/api/status', (req, res) => res.send('✅ Servidor funcionando'));

app.post('/api/registro', (req, res) => {
    const { nombres, email, password, rol } = req.body;
    if (!nombres || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
    try {
        const info = db.prepare('INSERT INTO usuarios (nombres, email, password, rol) VALUES (?, ?, ?, ?)')
                       .run(nombres, email, password, rol || 'estudiante');
        res.status(201).json({ mensaje: 'Registrado', id: info.lastInsertRowid });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Email ya registrado' });
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    try {
        const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
        if (!user || String(user.password) !== String(password)) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }
        res.status(200).json({ mensaje: 'OK', usuario: { id: user.id, nombres: user.nombres, email: user.email, rol: user.rol } });
    } catch (error) {
        res.status(500).json({ error: 'Error de servidor' });
    }
});

app.post('/api/riesgo', (req, res) => {
    const { estudiante_id, puntaje } = req.body;
    let nivel = puntaje >= 7 ? 'Crítico' : puntaje >= 5 ? 'Alto' : puntaje >= 3 ? 'Medio' : 'Bajo';
    try {
        db.prepare(`INSERT OR REPLACE INTO riesgo (estudiante_id, nivel, puntaje, fecha_evaluacion) VALUES (?, ?, ?, DATETIME('now'))`)
          .run(estudiante_id, nivel, puntaje);
        res.json({ mensaje: 'Guardado', nivel, puntaje });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.get('/api/riesgo/:id', (req, res) => {
    try {
        const riesgo = db.prepare('SELECT * FROM riesgo WHERE estudiante_id = ?').get(req.params.id);
        if (riesgo) res.json(riesgo);
        else res.status(44,).json({ mensaje: 'Sin evaluación' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    if (!model) {
        console.log("Intento de chat fallido: El modelo de IA no está cargado.");
        return res.status(500).json({ reply: "Lo siento, mi conexión con la IA no está configurada. (Error: API_KEY no encontrada)" });
    }

    const userMessage = req.body.message;
    const systemPrompt = `
        Eres "Rumbo Seguro", un asistente virtual amigable y empático para estudiantes de la
        Facultad de Ingeniería Industrial y de Sistemas (FIIS) de la Universidad Nacional de Ingeniería (UNI) en Perú.
        Tu propósito principal es apoyar a los estudiantes en riesgo académico.
        REGLAS CLAVE:
        1.  **Empatía primero:** Sé siempre comprensivo. Si un estudiante dice estar en "bika", "trika" o "estresado", tu primera reacción debe ser de apoyo. Valida sus sentimientos.
        2.  **No eres un psicólogo:** Si el tema es serio (depresión), sugiere gentilmente que busquen apoyo profesional con los psicólogos de la facultad.
        3.  **No eres un profesor:** No resuelvas tareas. Explica conceptos y sugiere buscar tutorías.
        4.  **Conocimiento local (FIIS/UNI):** Actúa como si conocieras la UNI.
        5.  **Respuestas cortas:** Mantén tus respuestas concisas para un chat.
    `;

    try {
        // --- ¡LA CORRECCIÓN ESTÁ AQUÍ! ---
        // Envolvimos el texto en [{ text: ... }]
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "¡Entendido! Estoy listo para ayudar a los estudiantes de la FIIS." }] }
            ]
        });
        // --- FIN DE LA CORRECCIÓN ---
        
        const result = await chat.sendMessage(userMessage); // .sendMessage(string) es correcto
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text });

    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        res.status(500).json({ reply: "Oops, mi cerebro principal (Gemini) tuvo un error. Intenta de nuevo." });
    }
});

// --- RUTA COMODÍN (Debe ir siempre AL FINAL) ---
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor listo en puerto ${PORT}\n`);
});
