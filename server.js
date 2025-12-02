const express = require('express');
const cors = require('cors');
const supabase = require('./database');
const path = require('path');
require('dotenv').config();

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

console.log("🔑 Verificando API Key:", process.env.API_KEY ? "¡Encontrada!" : "¡NO ENCONTRADA!");
console.log("🔑 Verificando SUPABASE_URL:", process.env.SUPABASE_URL ? "¡Encontrada!" : "¡NO ENCONTRADA!");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => res.send('✅ Servidor funcionando'));

// --- AUTENTICACIÓN Y PERFIL ---
app.post('/api/registro', async (req, res) => {
    const { nombres, email, password, rol, es_tutor, especialidad } = req.body;
    try {
        const { data, error } = await supabase.from('usuarios').insert({ nombres, email, password, rol: rol || 'estudiante', es_tutor: es_tutor || false, especialidad }).select().single();
        if (error) throw error;
        res.status(201).json({ mensaje: 'Registrado', id: data.id });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase.from('usuarios').select('*').eq('email', email).single();
        if (error || !user || user.password !== password) return res.status(401).json({ error: 'Credenciales incorrectas' });
        res.status(200).json({ mensaje: 'OK', usuario: { id: user.id, nombres: user.nombres, email: user.email, rol: user.rol } });
    } catch (error) { res.status(500).json({ error: 'Error servidor' }); }
});

app.get('/api/usuario/:id', async (req, res) => {
    const { data } = await supabase.from('usuarios').select('nombres, especialidad').eq('id', req.params.id).single();
    res.json(data || {});
});

app.patch('/api/usuario/:id', async (req, res) => {
    const { data, error } = await supabase.from('usuarios').update(req.body).eq('id', req.params.id).select().single();
    res.json(error ? { error: error.message } : data);
});

// --- RIESGO Y TUTORÍAS ---
app.post('/api/riesgo', async (req, res) => {
    const { estudiante_id, puntaje } = req.body;
    let nivel = puntaje >= 7 ? 'Crítico' : puntaje >= 5 ? 'Alto' : puntaje >= 3 ? 'Medio' : 'Bajo';
    try {
        const { data, error } = await supabase.from('riesgo').upsert({ estudiante_id, nivel, puntaje, fecha_evaluacion: (new Date()).toISOString() }, { onConflict: 'estudiante_id' }).select().single();
        if (error) throw error;
        res.json({ mensaje: 'Guardado', nivel: data.nivel });
    } catch (error) { res.status(500).json({ error: 'Error al guardar' }); }
});

// --- RUTA 4: Guardar Evaluación (LÓGICA CIENTÍFICA) ---
app.post('/api/riesgo', async (req, res) => {
    const { estudiante_id, puntaje } = req.body; // Recibe puntaje 0-10
    const p = parseFloat(puntaje);

    // Clasificación basada en la distribución normal del estudio [cite: 140]
    // Media aprox 3.5/10.
    let nivel = 'Bajo';
    if (p >= 7.0) nivel = 'Crítico';      // Riesgo de BIKA/TRIKA/Abandono
    else if (p >= 5.0) nivel = 'Alto';    // Acumulación de desaprobaciones
    else if (p >= 3.0) nivel = 'Medio';   // Bajo rendimiento
    // Menor a 3.0 es Bajo (Actitud proactiva)

    try {
        const { data, error } = await supabase
            .from('riesgo')
            .upsert({ 
                estudiante_id, 
                nivel, 
                puntaje: p, 
                fecha_evaluacion: (new Date()).toISOString() 
            }, { onConflict: 'estudiante_id' })
            .select()
            .single();

        if (error) throw error;
        
        res.json({ mensaje: 'Guardado', nivel: data.nivel, puntaje: data.puntaje });
    } catch (error) {
        console.error('Error al guardar riesgo:', error.message);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.get('/api/tutores', async (req, res) => {
    const { data } = await supabase.from('usuarios').select('id, nombres, especialidad').eq('es_tutor', true);
    res.json(data || []);
});

app.post('/api/solicitar-tutoria', async (req, res) => {
    const { error } = await supabase.from('tutorias').insert({ ...req.body, estado: 'solicitada' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ mensaje: 'Enviado' });
});

app.get('/api/solicitudes-tutor/:tutor_id', async (req, res) => {
    const { count } = await supabase.from('tutorias').select('*', { count: 'exact', head: true }).eq('tutor_id', req.params.tutor_id).eq('estado', 'solicitada');
    res.json({ count: count || 0 });
});

app.get('/api/solicitudes-detalle/:tutor_id', async (req, res) => {
    const { data } = await supabase.from('tutorias').select(`id, created_at, curso, estado, estudiante:usuarios!estudiante_id ( nombres, email )`).eq('tutor_id', req.params.tutor_id).eq('estado', 'solicitada');
    res.json(data || []);
});

app.patch('/api/tutorias/:id', async (req, res) => {
    const { error } = await supabase.from('tutorias').update({ estado: req.body.nuevo_estado }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ mensaje: 'Actualizado' });
});

// --- BIBLIOTECA (SOPORTE YOUTUBE) ---
app.get('/api/biblioteca', async (req, res) => {
    const { data } = await supabase.from('recursos').select(`id, created_at, nombre_archivo, curso, tipo, url_descarga, usuarios ( nombres )`);
    res.json(data || []);
});

app.post('/api/recursos', upload.single('archivo'), async (req, res) => {
    try {
        const { nombre_archivo, curso, tipo, uploader_id, youtube_url } = req.body;
        const file = req.file;

        // Validar permisos
        const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', uploader_id).single();
        if (usuario?.rol === 'estudiante') return res.status(403).json({ error: 'Sin permisos' });

        let finalUrl = '';

        // Lógica Híbrida: Archivo o YouTube
        if (file) {
            const fileName = `public/${Date.now()}-${file.originalname}`;
            const { error: upErr } = await supabase.storage.from('recursos_academicos').upload(fileName, file.buffer, { contentType: file.mimetype });
            if (upErr) throw upErr;
            const { data: pubUrl } = supabase.storage.from('recursos_academicos').getPublicUrl(fileName);
            finalUrl = pubUrl.publicUrl;
        } else if (youtube_url) {
            finalUrl = youtube_url;
        } else {
            return res.status(400).json({ error: 'Falta archivo o link' });
        }

        const { error: dbErr } = await supabase.from('recursos').insert({
            nombre_archivo, curso, tipo, uploader_id, url_descarga: finalUrl
        });
        if (dbErr) throw dbErr;

        res.json({ mensaje: 'Publicado' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- CHAT IA ---
app.post('/api/chat', async (req, res) => {
    if (!process.env.API_KEY) return res.status(500).json({ reply: "Falta API Key" });
    const systemPrompt = "Eres Rumbo Seguro, asistente de la FIIS UNI. Sé breve y empático.";
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${process.env.API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                "model": "openrouter/auto",
                "messages": [{ "role": "system", "content": systemPrompt }, { "role": "user", "content": req.body.message }]
            })
        });
        const data = await response.json();
        res.json({ reply: data.choices?.[0]?.message?.content || "Error IA" });
    } catch (e) {
        res.status(500).json({ reply: "Error de conexión IA" });
    }
});

app.get(/(.*)/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));

