const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 500 }, debug: false }
  },
  scene: [MenuScene, GameScene, GameOverScene]
};

new Phaser.Game(config);

// ------------------- MENU SCENE -------------------
function MenuScene() {}
MenuScene.prototype = {
  preload: function () {
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/sky1.png');
    this.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
    this.load.image('coin', 'assets/coin.png');
    this.load.image('obstacle', 'assets/obstacle.png');
    this.load.audio('jump', 'assets/jump.wav');
    this.load.audio('gameover', 'assets/gameover.wav');
    this.load.audio('bgmusic', 'assets/bgmusic.mp3');
  },
  create: function () {
    this.add.image(400, 300, 'sky');
    this.add.text(250, 200, 'LEVEL-UP GAME', { fontSize: '48px', fill: '#fff' });
    const startText = this.add.text(300, 300, 'Click to Start', { fontSize: '28px', fill: '#0f0' });
    startText.setInteractive();
    startText.on('pointerdown', () => this.scene.start('game'));
  }
};

// ------------------- GAME SCENE -------------------
function GameScene() {}
GameScene.prototype = {
  key: 'game',
  create: function () {
    this.add.image(400, 300, 'sky');
    this.score = 0;
    this.level = 1;
    this.coinSpeed = 2000;
    this.gameOver = false;

    // Background music
    this.bgMusic = this.sound.add('bgmusic', { loop: true, volume: 0.4 });
    this.bgMusic.play();

    // Sounds
    this.jumpSound = this.sound.add('jump');
    this.gameOverSound = this.sound.add('gameover');

    // Ground
    this.ground = this.physics.add.staticGroup();
    this.ground.create(400, 580, 'ground').setScale(2).refreshBody();

    // Player
    this.player = this.physics.add.sprite(100, 450, 'player');
    this.player.setCollideWorldBounds(true);

    // Coins & Obstacles
    this.coins = this.physics.add.group();
    this.obstacles = this.physics.add.group();

    // Spawn coins & obstacles
    this.coinTimer = this.time.addEvent({
      delay: this.coinSpeed,
      callback: this.spawnCoin,
      callbackScope: this,
      loop: true
    });

    this.obstacleTimer = this.time.addEvent({
      delay: 5000,
      callback: this.spawnObstacle,
      callbackScope: this,
      loop: true
    });

    // Score & Level Text
    this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
    this.levelText = this.add.text(16, 50, 'Level: 1', { fontSize: '24px', fill: '#fff' });

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.coins, this.ground);
    this.physics.add.collider(this.obstacles, this.ground);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
    this.physics.add.overlap(this.player, this.obstacles, this.hitObstacle, null, this);
  },

  update: function () {
    if (this.gameOver) return;

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-160);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(160);
    } else {
      this.player.setVelocityX(0);
    }

    if (this.cursors.up.isDown && this.player.body.touching.down) {
      this.player.setVelocityY(-350);
      this.jumpSound.play();
    }
  },

  spawnCoin: function () {
    const x = Phaser.Math.Between(50, 750);
    const coin = this.coins.create(x, 0, 'coin');
    coin.setBounce(0.3);
    coin.setCollideWorldBounds(false);
    coin.setVelocity(Phaser.Math.Between(-50, 50), 20);
  },

  spawnObstacle: function () {
    const x = Phaser.Math.Between(100, 700);
    const obstacle = this.obstacles.create(x, 0, 'obstacle');
    obstacle.setBounce(0.1);
    obstacle.setCollideWorldBounds(false);
    obstacle.setVelocity(0, 200 + this.level * 50);
  },

  collectCoin: function (player, coin) {
    coin.destroy();
    this.score += 10;
    this.scoreText.setText('Score: ' + this.score);

    // Level up every 50 points
    if (this.score % 50 === 0) {
      this.level++;
      this.levelText.setText('Level: ' + this.level);
      this.coinTimer.remove();
      this.coinSpeed = Math.max(800, this.coinSpeed - 200);
      this.coinTimer = this.time.addEvent({
        delay: this.coinSpeed,
        callback: this.spawnCoin,
        callbackScope: this,
        loop: true
      });
    }
  },

  hitObstacle: function (player, obstacle) {
    this.physics.pause();
    this.bgMusic.stop();
    player.setTint(0xff0000);
    this.gameOverSound.play();
    this.gameOver = true;
    this.scene.start('gameover', { score: this.score, level: this.level });
  }
};

// ------------------- GAME OVER SCENE -------------------
function GameOverScene() {}
GameOverScene.prototype = {
  key: 'gameover',
  init: function (data) {
    this.finalScore = data.score || 0;
    this.finalLevel = data.level || 1;
  },
  create: function () {
    this.add.image(400, 300, 'sky');
    this.add.text(250, 200, 'GAME OVER', { fontSize: '48px', fill: '#f00' });
    this.add.text(300, 280, 'Score: ' + this.finalScore, { fontSize: '28px', fill: '#fff' });
    this.add.text(300, 320, 'Level: ' + this.finalLevel, { fontSize: '28px', fill: '#fff' });

    const restartText = this.add.text(280, 400, 'Click to Restart', { fontSize: '28px', fill: '#0f0' });
    restartText.setInteractive();
    restartText.on('pointerdown', () => this.scene.start('game'));
  }
};
