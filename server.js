// --- Archivo: server.js (VERSIÓN CON REGISTRO DE TUTOR CORREGIDO) ---
const express = require('express');
const cors = require('cors');
const supabase = require('./database'); // Importamos Supabase
const path = require('path');
require('dotenv').config();

// Verificamos la API Key de OpenRouter
console.log("🔑 Verificando API Key de OpenRouter:", process.env.API_KEY ? "¡Encontrada!" : "¡NO ENCONTRADA!");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- SERVIR FRONTEND ESTATICO ---
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS API (Backend) ---
app.get('/api/status', (req, res) => res.send('✅ Servidor funcionando'));

// --- RUTA 2: Registro (SUPABASE) ---
app.post('/api/registro', async (req, res) => {
    // Recibimos los nuevos campos
    const { nombres, email, password, rol, es_tutor, especialidad } = req.body;
    
    if (!nombres || !email || !password) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert({
                nombres,
                email,
                password,
                rol: rol || 'estudiante',
                es_tutor: es_tutor || false,
                especialidad: especialidad
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Email duplicado
                return res.status(409).json({ error: 'Email ya registrado' });
            }
            throw error;
        }
        res.status(201).json({ mensaje: 'Registrado', id: data.id });
    } catch (error) {
        console.error('Error al registrar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- RUTA 3: Login (SUPABASE) ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user || String(user.password) !== String(password)) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        res.status(200).json({
            mensaje: 'OK',
            usuario: { id: user.id, nombres: user.nombres, email: user.email, rol: user.rol }
        });
    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(500).json({ error: 'Error de servidor' });
    }
});

// --- RUTA 4: Guardar Evaluación (SUPABASE) ---
app.post('/api/riesgo', async (req, res) => {
    const { estudiante_id, puntaje } = req.body;
    let nivel = puntaje >= 7 ? 'Crítico' : puntaje >= 5 ? 'Alto' : puntaje >= 3 ? 'Medio' : 'Bajo';
    
    try {
        const { data, error } = await supabase
            .from('riesgo')
            .upsert({ 
                estudiante_id, 
                nivel, 
                puntaje,
                fecha_evaluacion: (new Date()).toISOString() 
            }, { onConflict: 'estudiante_id' })
            .select()
            .single();

        if (error) throw error;
        res.json({ mensaje: 'Guardado', nivel: data.nivel, puntaje: data.puntaje });
    } catch (error) {
        console.error('Error al guardar riesgo:', error.message);
        // ¡AQUÍ ESTABA EL TYPO "5M"! (Corregido a 500)
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// --- RUTA 5: Obtener Riesgo (SUPABASE) ---
app.get('/api/riesgo/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const { data: riesgo, error } = await supabase
            .from('riesgo')
            .select('*')
            .eq('estudiante_id', id)
            .single();
            
        if (error || !riesgo) {
            return res.status(404).json({ mensaje: 'Sin evaluación' });
        }
        res.json(riesgo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RUTA 6: CHAT CON IA (OPENROUTER - MythoMax) ---
app.post('/api/chat', async (req, res) => {
    if (!process.env.API_KEY) {
        return res.status(500).json({ reply: "Error del servidor: La API_KEY no está configurada." });
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
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "gryphe/mythomax-l2-13b:free", 
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": userMessage }
                ]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error de OpenRouter:", errorBody);
            throw new Error(`Error de OpenRouter: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        res.json({ reply });

    } catch (error) {
        console.error("Error al llamar a la API de OpenRouter:", error);
        res.status(500).json({ reply: "Oops, mi cerebro principal (IA) tuvo un error. Intenta de nuevo." });
    }
});
// --- FIN DE LA RUTA DE CHAT ---

// --- RUTA COMODÍN (Debe ir siempre AL FINAL) ---
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor listo en puerto ${PORT}\n`);
});
