// --- Archivo: server.js (VERSIÓN FINAL - IA AUTO + CORRECCIONES) ---
const express = require('express');
const cors = require('cors');
const supabase = require('./database');
const path = require('path');
require('dotenv').config();

// --- Herramientas para subir archivos ---
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

console.log("🔑 Verificando API Key:", process.env.API_KEY ? "¡Encontrada!" : "¡NO ENCONTRADA!");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => res.send('✅ Servidor funcionando'));

// --- RUTA CHAT (IA AUTO) ---
app.post('/api/chat', async (req, res) => {
    if (!process.env.API_KEY) return res.status(500).json({ reply: "Error: Falta API Key." });
    
    const userMessage = req.body.message;
    const systemPrompt = `Eres "Rumbo Seguro", un asistente virtual amigable para estudiantes de ingeniería (FIIS UNI). Tu objetivo es dar apoyo académico y emocional. Sé breve, empático y usa jerga universitaria peruana si aplica.`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openrouter/auto", // ¡CAMBIO CLAVE! Elige el mejor modelo disponible
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": userMessage }
                ]
            })
        });

        if (!response.ok) throw new Error(`Error OpenRouter: ${response.status}`);
        const data = await response.json();
        
        // Validación extra por si la respuesta viene vacía
        const reply = data.choices?.[0]?.message?.content || "Lo siento, la IA está saturada. Intenta de nuevo.";
        res.json({ reply });

    } catch (error) {
        console.error("Error IA:", error);
        res.status(500).json({ reply: "Hubo un error conectando con la IA. Por favor intenta de nuevo." });
    }
});

// --- RESTO DE RUTAS (Iguales que antes, solo aseguro que estén) ---

app.post('/api/registro', async (req, res) => {
    const { nombres, email, password, rol, es_tutor, especialidad } = req.body;
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert({ nombres, email, password, rol: rol || 'estudiante', es_tutor: es_tutor || false, especialidad: especialidad })
            .select().single();
        if (error) throw error;
        res.status(201).json({ mensaje: 'Registrado', id: data.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase.from('usuarios').select('*').eq('email', email).single();
        if (error || !user || user.password !== password) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }
        res.status(200).json({ mensaje: 'OK', usuario: { id: user.id, nombres: user.nombres, email: user.email, rol: user.rol } });
    } catch (error) {
        res.status(500).json({ error: 'Error servidor' });
    }
});

app.post('/api/riesgo', async (req, res) => {
    const { estudiante_id, puntaje } = req.body;
    let nivel = puntaje >= 7 ? 'Crítico' : puntaje >= 5 ? 'Alto' : puntaje >= 3 ? 'Medio' : 'Bajo';
    try {
        // Asegúrate de haber renombrado 'created_at' a 'fecha_evaluacion' en Supabase
        const { data, error } = await supabase
            .from('riesgo')
            .upsert({ 
                estudiante_id, 
                nivel, 
                puntaje, 
                fecha_evaluacion: (new Date()).toISOString() 
            }, { onConflict: 'estudiante_id' })
            .select().single();
        if (error) throw error;
        res.json({ mensaje: 'Guardado', nivel: data.nivel });
    } catch (error) {
        console.error('Error riesgo:', error);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.get('/api/riesgo/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('riesgo').select('*').eq('estudiante_id', req.params.id).single();
        if (error || !data) return res.status(404).json({ mensaje: 'Sin datos' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tutores', async (req, res) => {
    const { data, error } = await supabase.from('usuarios').select('id, nombres, especialidad').eq('es_tutor', true);
    res.json(error ? [] : data);
});

app.post('/api/solicitar-tutoria', async (req, res) => {
    const { error } = await supabase.from('tutorias').insert({ ...req.body, estado: 'solicitada' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ mensaje: 'Solicitud enviada' });
});

app.get('/api/solicitudes-tutor/:tutor_id', async (req, res) => {
    const { count } = await supabase.from('tutorias').select('*', { count: 'exact', head: true }).eq('tutor_id', req.params.tutor_id).eq('estado', 'solicitada');
    res.json({ count: count || 0 });
});

app.get('/api/solicitudes-detalle/:tutor_id', async (req, res) => {
    const { data, error } = await supabase
        .from('tutorias')
        .select(`id, created_at, curso, estado, estudiante:usuarios!estudiante_id ( nombres, email )`)
        .eq('tutor_id', req.params.tutor_id)
        .eq('estado', 'solicitada');
    res.json(error ? [] : data);
});

app.patch('/api/tutorias/:id', async (req, res) => {
    const { error } = await supabase.from('tutorias').update({ estado: req.body.nuevo_estado }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ mensaje: 'Actualizado' });
});

// Rutas de Perfil
app.get('/api/usuario/:id', async (req, res) => {
    const { data } = await supabase.from('usuarios').select('nombres, especialidad').eq('id', req.params.id).single();
    res.json(data || {});
});
app.patch('/api/usuario/:id', async (req, res) => {
    const { data, error } = await supabase.from('usuarios').update(req.body).eq('id', req.params.id).select().single();
    res.json(error ? { error: error.message } : data);
});

// Rutas Biblioteca
app.get('/api/biblioteca', async (req, res) => {
    const { data } = await supabase.from('recursos').select(`id, created_at, nombre_archivo, curso, tipo, url_descarga, usuarios ( nombres )`);
    res.json(data || []);
});
app.post('/api/recursos', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) throw new Error('Falta archivo');
        const fileName = `public/${Date.now()}-${req.file.originalname}`;
        const { error: upErr } = await supabase.storage.from('recursos_academicos').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
        if (upErr) throw upErr;
        
        const { data: pubUrl } = supabase.storage.from('recursos_academicos').getPublicUrl(fileName);
        const { error: dbErr } = await supabase.from('recursos').insert({
            nombre_archivo: req.body.nombre_archivo,
            curso: req.body.curso,
            tipo: req.body.tipo,
            uploader_id: req.body.uploader_id,
            url_descarga: pubUrl.publicUrl
        });
        if (dbErr) throw dbErr;
        res.json({ mensaje: 'Subido' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get(/(.*)/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
