// public/script.js (ACTUALIZADO)
const loginForm = document.getElementById('login-form');
const msgError = document.getElementById('msg-error');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        if (msgError) msgError.style.display = 'none';

        try {
            const res = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                window.location.href = 'dashboard.html';
            } else {
                if (msgError) {
                    msgError.textContent = data.error || 'Error de credenciales';
                    msgError.style.display = 'block';
                }
            }
        } catch (error) {
            if (msgError) {
                msgError.textContent = 'Error de conexión';
                msgError.style.display = 'block';
            }
        }
    });
}