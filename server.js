// --- Archivo: server.js (VERSIÓN MAESTRA FINAL - SIN RECORTES) ---
const express = require('express');
const cors = require('cors');
const supabase = require('./database'); // Importamos la conexión a Supabase
const path = require('path');
require('dotenv').config();

// --- Configuración para subir archivos (Multer en memoria) ---
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Verificaciones de seguridad en consola
console.log("🔑 API Key IA:", process.env.API_KEY ? "OK" : "FALTA");
console.log("🔑 Base de Datos:", process.env.SUPABASE_URL ? "OK" : "FALTA");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ruta de prueba
app.get('/api/status', (req, res) => res.send('✅ Servidor Rumbo Seguro funcionando'));

/* =========================================
   1. AUTENTICACIÓN (LOGIN / REGISTRO)
   ========================================= */
app.post('/api/registro', async (req, res) => {
    const { nombres, email, password, rol, es_tutor, especialidad } = req.body;
    
    if (!nombres || !email || !password) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert({
                nombres,
                email,
                password, // Nota: En producción real, usar hash
                rol: rol || 'estudiante',
                es_tutor: es_tutor || false,
                especialidad: especialidad
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'El correo ya está registrado' });
            throw error;
        }
        res.status(201).json({ mensaje: 'Usuario registrado', id: data.id });
    } catch (error) {
        console.error('Error registro:', error.message);
        res.status(500).json({ error: error.message });
    }
});

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
            mensaje: 'Login exitoso',
            usuario: { id: user.id, nombres: user.nombres, email: user.email, rol: user.rol }
        });
    } catch (error) {
        console.error('Error login:', error.message);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

/* =========================================
   2. PERFIL DE USUARIO
   ========================================= */
app.get('/api/usuario/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('nombres, especialidad')
            .eq('id', id)
            .single();
        if (error) throw error;
        res.json(data || {});
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/usuario/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

/* =========================================
   3. RIESGO ACADÉMICO (LÓGICA CIENTÍFICA)
   ========================================= */
app.post('/api/riesgo', async (req, res) => {
    const { estudiante_id, puntaje } = req.body;
    const p = parseFloat(puntaje);

    // Clasificación basada en el estudio IMRA (Escala 0-10)
    let nivel = 'Bajo';
    if (p >= 7.0) nivel = 'Crítico';
    else if (p >= 5.0) nivel = 'Alto';
    else if (p >= 3.0) nivel = 'Medio';

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
        console.error('Error riesgo:', error);
        res.status(500).json({ error: 'Error al guardar riesgo' });
    }
});

app.get('/api/riesgo/:id', async (req, res) => {
    try {
        const { data } = await supabase
            .from('riesgo')
            .select('*')
            .eq('estudiante_id', req.params.id)
            .single();
        
        if (!data) return res.status(404).json({ mensaje: 'Sin evaluación previa' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RUTA PARA EL PSICÓLOGO (VER CASOS EN RIESGO) ---
app.get('/api/casos-riesgo', async (req, res) => {
    try {
        // Obtiene riesgos Altos y Críticos junto con info del alumno
        const { data, error } = await supabase
            .from('riesgo')
            .select(`
                id, nivel, puntaje, fecha_evaluacion,
                estudiante:usuarios!estudiante_id ( id, nombres, email )
            `)
            .in('nivel', ['Alto', 'Crítico', 'Medio'])
            .order('puntaje', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error psicólogo:', error);
        // Fallback si falla el JOIN
        const { data } = await supabase.from('riesgo').select('*').in('nivel', ['Alto', 'Crítico']);
        res.json(data || []);
    }
});

/* =========================================
   4. BIBLIOTECA (ARCHIVOS + YOUTUBE)
   ========================================= */
app.get('/api/biblioteca', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('recursos')
            .select(`
                id, created_at, nombre_archivo, curso, tipo, url_descarga, 
                usuarios ( nombres )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/recursos', upload.single('archivo'), async (req, res) => {
    try {
        const { nombre_archivo, curso, tipo, uploader_id, youtube_url } = req.body;
        const file = req.file;

        // Validar permisos del usuario
        const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', uploader_id).single();
        if (usuario?.rol === 'estudiante') return res.status(403).json({ error: 'Sin permisos para subir' });

        let finalUrl = '';

        if (file) {
            // Subir archivo a Supabase Storage
            const fileName = `public/${Date.now()}-${file.originalname}`;
            const { error: upErr } = await supabase.storage
                .from('recursos_academicos')
                .upload(fileName, file.buffer, { contentType: file.mimetype });
            
            if (upErr) throw upErr;
            
            const { data: pubUrl } = supabase.storage
                .from('recursos_academicos')
                .getPublicUrl(fileName);
            
            finalUrl = pubUrl.publicUrl;
        } else if (youtube_url) {
            finalUrl = youtube_url;
        } else {
            return res.status(400).json({ error: 'Falta archivo o link' });
        }

        const { error: dbErr } = await supabase
            .from('recursos')
            .insert({
                nombre_archivo, curso, tipo, uploader_id, 
                url_descarga: finalUrl
            });

        if (dbErr) throw dbErr;
        res.json({ mensaje: 'Recurso publicado' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

/* =========================================
   5. TUTORÍAS Y SOLICITUDES (¡AQUÍ ESTÁ TODO!)
   ========================================= */
app.get('/api/tutores', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('id, nombres, especialidad')
            .eq('es_tutor', true);
        
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/solicitar-tutoria', async (req, res) => {
    try {
        const { error } = await supabase
            .from('tutorias')
            .insert({ ...req.body, estado: 'solicitada' });
        
        if (error) throw error;
        res.status(201).json({ mensaje: 'Solicitud enviada' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/solicitudes-tutor/:tutor_id', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('tutorias')
            .select('*', { count: 'exact', head: true })
            .eq('tutor_id', req.params.tutor_id)
            .eq('estado', 'solicitada');
        
        if (error) throw error;
        res.json({ count: count || 0 });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Detalle de solicitudes
app.get('/api/solicitudes-detalle/:tutor_id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tutorias')
            .select(`
                id, created_at, curso, estado,
                estudiante:usuarios!estudiante_id ( nombres, email )
            `)
            .eq('tutor_id', req.params.tutor_id)
            .eq('estado', 'solicitada');
        
        if (error) throw error;
        res.json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/tutorias/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('tutorias')
            .update({ estado: req.body.nuevo_estado })
            .eq('id', req.params.id);
        
        if (error) throw error;
        res.json({ mensaje: 'Estado actualizado' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

/* =========================================
   6. CHAT IA (OPENROUTER AUTO)
   ========================================= */
app.post('/api/chat', async (req, res) => {
    if (!process.env.API_KEY) return res.status(500).json({ reply: "Error: Falta API Key." });

    const userMessage = req.body.message;
    const systemPrompt = "Eres Rumbo Seguro, asistente de la FIIS UNI. Sé breve, empático y útil. Responde siempre en español.";

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openrouter/auto", // Modelo automático gratuito
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": userMessage }
                ]
            })
        });

        const data = await response.json();
        res.json({ reply: data.choices?.[0]?.message?.content || "Lo siento, intenta de nuevo." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ reply: "Error de conexión con la IA." });
    }
});

// --- RUTA COMODÍN ---
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
