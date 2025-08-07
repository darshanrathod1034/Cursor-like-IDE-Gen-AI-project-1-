// Get the canvas and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
const bird = {
    x: 50,
    y: 150,
    width: 20,
    height: 20,
    gravity: 0.2,
    lift: -4,
    velocity: 0
};

const pipes = [];
const pipeWidth = 40;
const pipeGap = 100;
const pipeSpeed = 1;
let frame = 0;
let score = 0;
let gameOver = false;

// Function to draw the bird
function drawBird() {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
}

// Function to draw pipes
function drawPipes() {
    pipes.forEach(pipe => {
        ctx.fillStyle = 'green';
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
        ctx.fillRect(pipe.x, canvas.height - pipe.bottom, pipeWidth, pipe.bottom);
    });
}

// Function to update game state
function update() {
    if (gameOver) return;

    // Bird physics
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // Prevent bird from going off top
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }

    // Game over if bird hits ground
    if (bird.y + bird.height > canvas.height) {
        endGame();
        return;
    }

    // Generate pipes
    if (frame % 150 === 0) { // Generate a new pipe every 150 frames
        const topHeight = Math.random() * (canvas.height - pipeGap - 50) + 20; // Ensure pipes are not too small or too large
        const bottomHeight = canvas.height - topHeight - pipeGap;
        pipes.push({
            x: canvas.width,
            top: topHeight,
            bottom: bottomHeight
        });
    }

    // Move pipes and check for collision
    pipes.forEach((pipe, index) => {
        pipe.x -= pipeSpeed;

        // Remove off-screen pipes
        if (pipe.x + pipeWidth < 0) {
            pipes.splice(index, 1);
        }

        // Collision detection
        if (
            bird.x < pipe.x + pipeWidth &&
            bird.x + bird.width > pipe.x &&
            (
                bird.y < pipe.top ||
                bird.y + bird.height > canvas.height - pipe.bottom
            )
        ) {
            endGame();
        }

        // Score increment
        if (bird.x > pipe.x + pipeWidth && !pipe.counted) {
            score++;
            pipe.counted = true; // Mark pipe as counted
        }
    });

    // Clear canvas and redraw elements
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPipes();
    drawBird();

    // Display score
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + score, 10, 30);

    frame++;
    requestAnimationFrame(update);
}

// Function to handle keyboard input
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !gameOver) {
        bird.velocity = bird.lift;
    }
    if (e.code === 'Space' && gameOver) { // Restart game on space if game over
        resetGame();
    }
});

// Function to end the game
function endGame() {
    gameOver = true;
    ctx.fillStyle = 'red';
    ctx.font = '30px Arial';
    ctx.fillText('Game Over!', canvas.width / 2 - 80, canvas.height / 2);
    ctx.fillText('Press Space to Restart', canvas.width / 2 - 130, canvas.height / 2 + 40);
}

// Function to reset the game
function resetGame() {
    bird.y = 150;
    bird.velocity = 0;
    pipes.length = 0;
    score = 0;
    frame = 0;
    gameOver = false;
    update(); // Start the game loop again
}

// Start the game loop
update();