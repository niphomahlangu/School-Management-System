// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const overlay = document.getElementById('overlay');
const profileButton = document.getElementById('profileButton');
const dropdownMenu = document.getElementById('dropdownMenu');
const logoutButton = document.getElementById('logoutButton');
const navLinks = document.querySelectorAll('.sidebar-nav a');

// Toggle sidebar
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    mainContent.classList.toggle('shifted');
    overlay.classList.toggle('active');
});

// Close sidebar when clicking overlay
overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    mainContent.classList.remove('shifted');
    overlay.classList.remove('active');
});

// Toggle profile dropdown
profileButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!profileButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('active');
    }
});

// Handle logout
logoutButton.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Prevent going back after logout
                window.location.replace('/');
            } else {
                alert('Error logging out. Please try again.');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }
});

// Handle navigation link clicks (only intercept hash links like #students)
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href') || '';

        // For normal page links (e.g. users.html), let the browser navigate
        if (!href.startsWith('#')) {
            return;
        }

        // For in-page/hash navigation, prevent default and handle manually
        e.preventDefault();
        
        // Remove active class from all links
        navLinks.forEach(l => l.classList.remove('active'));
        
        // Add active class to clicked link
        link.classList.add('active');
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
            mainContent.classList.remove('shifted');
            overlay.classList.remove('active');
        }
        
        // Here you can add logic to load different content based on the clicked link
        const section = href.substring(1);
        console.log('Navigating to:', section);
    });
});

// Keep sidebar open on desktop by default
if (window.innerWidth > 768) {
    sidebar.classList.add('active');
    mainContent.classList.add('shifted');
}

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        overlay.classList.remove('active');
    }
});

// Load user data on page load
async function loadUserData() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
                // Update profile with user data
                const profileIcon = document.querySelector('.profile-icon');
                const profileName = document.querySelector('.profile-name');
                
                profileIcon.textContent = data.userName.charAt(0).toUpperCase();
                profileName.textContent = data.userName;
            }
        } else {
            // Not authenticated, redirect to login
            window.location.replace('/');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Prevent back button after logout
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Page was loaded from cache, check authentication
        fetch('/api/user')
            .then(response => {
                if (!response.ok) {
                    window.location.replace('/');
                }
            })
            .catch(() => {
                window.location.replace('/');
            });
    }
});

// Load user data when page loads
loadUserData();
