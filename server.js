// --- Archivo: server.js (VERSIÓN CON SUBIDA DE ARCHIVOS MANUAL) ---
const express = require('express');
const cors = require('cors');
const supabase = require('./database'); // Importamos Supabase
const path = require('path');
require('dotenv').config();

// --- ¡NUEVA HERRAMIENTA PARA SUBIR ARCHIVOS! ---
const multer = require('multer');
// Configuramos Multer para guardar el archivo en la memoria temporal
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// --- FIN DE NUEVAS HERRAMIENTAS ---

console.log("🔑 Verificando API Key de OpenRouter:", process.env.API_KEY ? "¡Encontrada!" : "¡NO ENCONTRADA!");
console.log("🔑 Verificando SUPABASE_URL:", process.env.SUPABASE_URL ? "¡Encontrada!" : "¡NO ENCONTRADA!");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json()); // Para leer JSON
app.use(express.urlencoded({ extended: true })); // Para leer datos de formularios

// --- SERVIR FRONTEND ESTATICO ---
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS API (Backend) ---
app.get('/api/status', (req, res) => res.send('✅ Servidor funcionando'));

// --- RUTA 2: Registro (SUPABASE) ---
app.post('/api/registro', async (req, res) => {
    const { nombres, email, password, rol, es_tutor, especialidad } = req.body;
    if (!nombres || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert({ nombres, email, password, rol: rol || 'estudiante', es_tutor: es_tutor || false, especialidad: especialidad })
            .select().single();
        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Email ya registrado' });
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
        const { data: user, error } = await supabase.from('usuarios').select('*').eq('email', email).single();
        if (error || !user || String(user.password) !== String(password)) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }
        res.status(200).json({ mensaje: 'OK', usuario: { id: user.id, nombres: user.nombres, email: user.email, rol: user.rol } });
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
            .upsert({ estudiante_id, nivel, puntaje, fecha_evaluacion: (new Date()).toISOString() }, { onConflict: 'estudiante_id' })
            .select().single();
        if (error) throw error;
        res.json({ mensaje: 'Guardado', nivel: data.nivel, puntaje: data.puntaje });
    } catch (error) {
        console.error('Error al guardar riesgo:', error.message);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// --- RUTA 5: Obtener Riesgo (SUPABASE) ---
app.get('/api/riesgo/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const { data: riesgo, error } = await supabase.from('riesgo').select('*').eq('estudiante_id', id).single();
        if (error || !riesgo) return res.status(404).json({ mensaje: 'Sin evaluación' });
        res.json(riesgo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RUTA 6: CHAT CON IA (OPENROUTER) ---
app.post('/api/chat', async (req, res) => {
    if (!process.env.API_KEY) return res.status(500).json({ reply: "Error del servidor: La API_KEY no está configurada." });
    const userMessage = req.body.message;
    const systemPrompt = `Eres "Rumbo Seguro", un asistente virtual amigable y empático para estudiantes de la FIIS UNI. Tu propósito es apoyar a estudiantes en riesgo académico. Sé empático, no resuelvas tareas (explica conceptos), y si es serio, sugiere ayuda profesional. Usa conocimiento local (bika, trika, FIIS, UNI) y respuestas cortas.`;
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                "model": "gryphe/mythomax-l2-13b:free", 
                "messages": [{ "role": "system", "content": systemPrompt }, { "role": "user", "content": userMessage }]
            })
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error de OpenRouter:", errorBody);
            throw new Error(`Error de OpenRouter: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        res.json({ reply: data.choices[0].message.content });
    } catch (error) {
        console.error("Error al llamar a la API de OpenRouter:", error);
        res.status(500).json({ reply: "Oops, mi cerebro principal (IA) tuvo un error. Intenta de nuevo." });
    }
});

// --- ¡RUTAS DE BIBLIOTECA ACTUALIZADAS! ---

// RUTA 7: Obtener lista de recursos
app.get('/api/biblioteca', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('recursos')
            .select(`id, created_at, nombre_archivo, curso, tipo, url_descarga, usuarios ( nombres )`);
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error al obtener recursos:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// RUTA 8: Subir un nuevo recurso (¡LÓGICA MANUAL!)
// 'archivo' es el nombre del campo en el formulario (lo veremos en el HTML)
app.post('/api/recursos', upload.single('archivo'), async (req, res) => {
    try {
        // Datos del formulario de texto
        const { nombre_archivo, curso, tipo, uploader_id } = req.body;
        // Datos del archivo (en memoria)
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

        // 1. Creamos un nombre único para el archivo
        const fileName = `public/${Date.now()}-${file.originalname}`;

        // 2. Subimos el archivo (buffer) a Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('recursos_academicos') // El nombre de tu balde
            .upload(fileName, file.buffer, {
                contentType: file.mimetype
            });

        if (uploadError) throw uploadError;

        // 3. Obtenemos la URL pública del archivo que acabamos de subir
        const { data: publicUrlData } = supabase
            .storage
            .from('recursos_academicos')
            .getPublicUrl(fileName);

        // 4. Guardamos la información en nuestra tabla "recursos"
        const { error: dbError } = await supabase
            .from('recursos')
            .insert({
                nombre_archivo,
                curso,
                tipo,
                uploader_id,
                url_descarga: publicUrlData.publicUrl
            });

        if (dbError) throw dbError;

        res.status(201).json({ mensaje: 'Archivo subido y registrado exitosamente' });
    } catch (error) {
        console.error('Error al subir recurso:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// --- FIN DE RUTAS DE BIBLIOTECA ---

// --- RUTA COMODÍN (Debe ir siempre AL FINAL) ---
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor listo en puerto ${PORT}\n`);
});
