document.addEventListener('DOMContentLoaded', () => {
    
    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            navbar.style.padding = '10px 0';
        } else {
            navbar.style.boxShadow = 'none';
            navbar.style.padding = '15px 0';
        }
    });

    // Form Submittion Logic to n8n Webhook
    const form = document.getElementById('leadForm');
    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI Feedback
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = 'Enviando...';
        submitBtn.disabled = true;
        formMessage.classList.add('hidden');
        formMessage.className = 'form-message hidden'; // Reset classes
        
        // Collect Data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.timestamp = new Date().toISOString();
        
        // Webhook URL Placeholder
        // Configurado según lo solicitado para localhost:5678
        const WEBHOOK_URL = 'http://localhost:5678/webhook/plc-leads';

        try {
            // Nota: En un entorno de desarrollo con webhook local sin CORS
            // configurado, esto podría arrojar error de CORS en el navegador.
            // Para production en n8n, se sugiere configurar OPTIONS o modo "no-cors"
            // si solo se envía info.
            
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            // Consideramos éxito si responde OK o si al menos la promesa local se resolvió
            if (response.ok || response.type === 'opaque') {
                formMessage.innerText = '¡Gracias por tu interés! Nos pondremos en contacto pronto.';
                formMessage.classList.add('success');
                formMessage.classList.remove('hidden');
                form.reset();
            } else {
                throw new Error('Error en el servidor (' + response.status + ')');
            }
            
        } catch (error) {
            console.error('Error enviando datos al webhook:', error);
            
            // Usualmente si el webhook de n8n no está corriendo, caerá aquí.
            // Mostramos un mensaje amable
            formMessage.innerText = 'El servicio no está disponible temporalmente. Intenta más tarde.';
            formMessage.classList.add('error');
            formMessage.classList.remove('hidden');
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    // Smooth scroll para anclas internas
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if(targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
