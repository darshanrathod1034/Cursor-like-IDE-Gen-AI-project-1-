// Smooth scrolling for navigation links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Intersection Observer for scroll animations
const sections = document.querySelectorAll('.section-scroll');

const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15 // Adjust as needed to control when animation triggers
};

const sectionObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            // observer.unobserve(entry.target); // Uncomment if you want the animation to play only once
        } else {
            entry.target.classList.remove('active'); // Optional: reset animation when out of view
        }
    });
}, observerOptions);

sections.forEach(section => {
    sectionObserver.observe(section);
});
