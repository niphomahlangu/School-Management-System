const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const errorMessage = document.getElementById('errorMessage');

// Email validation pattern
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Real-time validation
emailInput.addEventListener('blur', () => {
    if (!emailInput.value.trim()) {
        showError(emailError, 'Email is required');
    } else if (!emailPattern.test(emailInput.value)) {
        showError(emailError, 'Please enter a valid email address');
    } else {
        hideError(emailError);
    }
});

passwordInput.addEventListener('blur', () => {
    if (!passwordInput.value) {
        showError(passwordError, 'Password is required');
    } else if (passwordInput.value.length < 6) {
        showError(passwordError, 'Password must be at least 6 characters');
    } else {
        hideError(passwordError);
    }
});

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(emailError);
    hideError(passwordError);
    errorMessage.style.display = 'none';

    let isValid = true;

    // Validate email
    if (!emailInput.value.trim()) {
        showError(emailError, 'Email is required');
        isValid = false;
    } else if (!emailPattern.test(emailInput.value)) {
        showError(emailError, 'Please enter a valid email address');
        isValid = false;
    }

    // Validate password
    if (!passwordInput.value) {
        showError(passwordError, 'Password is required');
        isValid = false;
    } else if (passwordInput.value.length < 6) {
        showError(passwordError, 'Password must be at least 6 characters');
        isValid = false;
    }

    if (!isValid) return;

    // Submit form via fetch for better error handling
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: emailInput.value,
                password: passwordInput.value
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Use replace to prevent going back to login page
            window.location.replace(data.redirectUrl || '/home');
        } else {
            errorMessage.textContent = data.message || 'Invalid credentials';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        errorMessage.textContent = 'An error occurred. Please try again.';
        errorMessage.style.display = 'block';
    }
});

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function hideError(element) {
    element.style.display = 'none';
}
