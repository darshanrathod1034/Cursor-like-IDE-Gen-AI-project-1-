
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startButton = document.getElementById('startButton');
const gameOverDisplay = document.getElementById('gameOver');

canvas.width = 400;
canvas.height = 600;

// Game variables
let playerCar;
let obstacles = [];
let score;
let gameOver;
let gameRunning = false;
let obstacleSpeed;
let obstacleInterval;
let animationId;

// Player car properties
const playerCarWidth = 50;
const playerCarHeight = 80;

// Obstacle properties
const obstacleWidth = 50;
const obstacleHeight = 80;
const minObstacleSpeed = 3;
const maxObstacleSpeedIncrease = 0.5; // How much speed increases per 10 points
const obstacleSpawnRate = 1200; // ms

// Key tracking
let keysPressed = {};

document.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
});
document.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});

startButton.addEventListener('click', startGame);

// Initialize game state
function initGame() {
    playerCar = {
        x: canvas.width / 2 - playerCarWidth / 2,
        y: canvas.height - playerCarHeight - 10,
        width: playerCarWidth,
        height: playerCarHeight,
        color: 'blue'
    };
    obstacles = [];
    score = 0;
    gameOver = false;
    gameRunning = false;
    obstacleSpeed = minObstacleSpeed;
    scoreDisplay.textContent = `Score: ${score}`;
    startButton.classList.remove('hidden');
    gameOverDisplay.classList.add('hidden');

    // Clear any existing animation frames
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    // Clear any existing obstacle intervals
    if (obstacleInterval) {
        clearInterval(obstacleInterval);
    }
    draw(); // Draw initial state
}

// Start the game
function startGame() {
    initGame(); // Reset everything before starting
    gameRunning = true;
    startButton.classList.add('hidden');
    obstacleInterval = setInterval(generateObstacle, obstacleSpawnRate);
    gameLoop();
}

// Draw a car (player or obstacle)
function drawCar(car) {
    ctx.fillStyle = car.color;
    ctx.fillRect(car.x, car.y, car.width, car.height);
    // Add some simple car details
    ctx.fillStyle = 'lightgray';
    ctx.fillRect(car.x + 5, car.y + 10, 10, 20); // Front lights
    ctx.fillRect(car.x + car.width - 15, car.y + 10, 10, 20);
    ctx.fillRect(car.x + 5, car.y + car.height - 30, 10, 20); // Back lights
    ctx.fillRect(car.x + car.width - 15, car.y + car.height - 30, 10, 20);
    ctx.fillStyle = 'darkgray';
    ctx.fillRect(car.x + car.width / 2 - 5, car.y + car.height / 2 - 10, 10, 20); // Window
}

// Draw the road lines
function drawRoad() {
    ctx.fillStyle = '#666'; // Road lines color
    const laneWidth = canvas.width / 3; // Three lanes
    const dashLength = 20;
    const dashSpace = 20;
    const numDashes = canvas.height / (dashLength + dashSpace);

    for (let i = 0; i < numDashes; i++) {
        const y = i * (dashLength + dashSpace);
        // Middle line
        ctx.fillRect(laneWidth - 2, y, 4, dashLength);
        ctx.fillRect(2 * laneWidth - 2, y, 4, dashLength);
    }
}

// Generate a new obstacle
function generateObstacle() {
    const randomX = Math.floor(Math.random() * (canvas.width - obstacleWidth));
    const colors = ['red', 'green', 'purple', 'orange', 'white'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    obstacles.push({
        x: randomX,
        y: -obstacleHeight, // Start above the canvas
        width: obstacleWidth,
        height: obstacleHeight,
        color: randomColor
    });
}

// Check for collision between two rectangles
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// End the game
function endGame() {
    gameOver = true;
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(obstacleInterval);
    gameOverDisplay.classList.remove('hidden');
    startButton.textContent = 'Play Again';
    startButton.classList.remove('hidden');
}

// Update game state
function update() {
    if (!gameRunning) return;

    // Player movement
    const playerSpeed = 5;
    if (keysPressed['ArrowLeft'] && playerCar.x > 0) {
        playerCar.x -= playerSpeed;
    }
    if (keysPressed['ArrowRight'] && playerCar.x + playerCar.width < canvas.width) {
        playerCar.x += playerSpeed;
    }

    // Obstacle movement and collision detection
    for (let i = 0; i < obstacles.length; i++) {
        let obstacle = obstacles[i];
        obstacle.y += obstacleSpeed;

        // Check for collision with player car
        if (checkCollision(playerCar, obstacle)) {
            endGame();
            return; // Stop updating if game over
        }

        // Remove obstacles that go off-screen and increase score
        if (obstacle.y > canvas.height) {
            obstacles.splice(i, 1);
            score++;
            scoreDisplay.textContent = `Score: ${score}`;
            // Increase obstacle speed every 10 points
            if (score % 10 === 0 && score !== 0) {
                obstacleSpeed += maxObstacleSpeedIncrease;
            }
            i--; // Adjust index after removing an element
        }
    }
}

// Drawing function
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRoad();
    drawCar(playerCar);
    obstacles.forEach(drawCar);
}

// Main game loop
function gameLoop() {
    update();
    draw();
    if (!gameOver) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// Initial setup
initGame();
