// --- Archivo: public/script.js (VERSIÓN FINAL PARA RENDER) ---

/* Lógica para el formulario de LOGIN (en login.html) */
const loginForm = document.getElementById('login-form');
// Asegúrate de que tu HTML de login tenga id="msg-error" para el error
const msgErrorLogin = document.getElementById('msg-error'); 

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if (msgErrorLogin) msgErrorLogin.style.display = 'none';

        try {
            // USA RUTA RELATIVA (¡ESTA ES LA CORRECCIÓN!)
            const res = await fetch('/api/login', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                window.location.href = 'dashboard.html';
            } else {
                if (msgErrorLogin) {
                    msgErrorLogin.textContent = data.error || 'Error de credenciales';
                    msgErrorLogin.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error de fetch en login:', error);
            if (msgErrorLogin) {
                msgErrorLogin.textContent = 'Error de conexión con el servidor.';
                msgErrorLogin.style.display = 'block';
            }
        }
    });
}
