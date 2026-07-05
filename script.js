const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiCanvas = document.getElementById('uiCanvas'); 
const uiCtx = uiCanvas.getContext('2d');              

const healthBar = document.getElementById('health-bar');
const scoreDisplay = document.getElementById('score-display');
const gameOverScreen = document.getElementById('game-over');
const damageFlash = document.getElementById('damage-flash');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const pauseScreen = document.getElementById('pause-screen');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
uiCanvas.width = window.innerWidth;
uiCanvas.height = window.innerHeight;
const enemyImg = new Image();
enemyImg.src = 'enemy.png'; 
let isImageLoaded = false;
enemyImg.onload = () => { isImageLoaded = true; };

const shootSound = new Audio('laser.mp3');
const damageSound = new Audio('damage.mp3');
const gameOverSound = new Audio('gameover.mp3'); 

function playAudio(audioObj) {
    const soundClone = audioObj.cloneNode();
    soundClone.volume = 0.6; 
    soundClone.play().catch(e => console.log("audio blocked."));
}

let gameStarted = false; 
let isPaused = false; 
let spawnTimerId; 

let playerHealth = 100; 
let playerLives = 5;    
const maxLives = 5;
let totalKills = 0;
let score = 0;
let isGameOver = false;

let enemies = [];
let enemyLasers = []; 
let stars = [];
let playerLasers = []; 

const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
const turnSpeed = 10; 
let spawnDelay = 4000; 
let maxEnemiesOnScreen = 1; 

startBtn.addEventListener('click', () => {
    startScreen.style.display = 'none'; 
    document.body.classList.add('game-active'); 
    gameStarted = true;
    init(); 
});

class Star {
    constructor() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.size = Math.random() * 2; this.speed = Math.random() * 5 + 2; }
    update(panX, panY) {
        this.y += this.speed + panY; this.x += panX;
        if (this.y > canvas.height) this.y = 0; else if (this.y < 0) this.y = canvas.height;
        if (this.x > canvas.width) this.x = 0; else if (this.x < 0) this.x = canvas.width;
    }
    draw() { ctx.fillStyle = "white"; ctx.fillRect(this.x, this.y, this.size, this.size); }
}

class EnemyLaser {
    constructor(x, y) { this.x = x; this.y = y; this.size = 2; this.speed = 1.5; this.markedForDeletion = false; }
    update(panX, panY) {
        const cx = canvas.width / 2; const cy = canvas.height / 2;
        const dx = cx - this.x; const dy = cy - this.y;
        this.x += (dx * 0.05) + panX; this.y += (dy * 0.05) + panY; this.size += this.speed;
        
        if (this.size > 25) { this.markedForDeletion = true; takeDamage(5); } 
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 50, 50, 0.8)'; ctx.fill();
    }
}

class Enemy {
    constructor(forceCenter = false) {
        if (forceCenter) { this.x = canvas.width / 2; this.y = canvas.height / 2; } 
        else { this.x = (Math.random() * canvas.width * 0.8) + (canvas.width * 0.1); this.y = (Math.random() * canvas.height * 0.6) + (canvas.height * 0.1); }
        this.size = 30; this.maxSize = 250; this.growthRate = Math.random() * 0.15 + 0.1; this.markedForDeletion = false; this.maxHealth = 100; this.health = 100;
        this.currentWidth = this.size; this.currentHeight = this.size;
    }
    update(panX, panY) {
        this.size += this.growthRate; this.x += panX; this.y += panY;
        if (Math.random() < 0.015 && this.size > 50 && this.size < 200) { enemyLasers.push(new EnemyLaser(this.x, this.y)); }
        
        if (this.size >= this.maxSize) {
            this.markedForDeletion = true;
            if (Math.abs(this.x - canvas.width / 2) < 300) { takeDamage(15); } 
        }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.shadowBlur = 0; 

        if (isImageLoaded) {
            const aspect = enemyImg.width / (enemyImg.height || 1); this.currentWidth = this.size * aspect; this.currentHeight = this.size;
            ctx.drawImage(enemyImg, -this.currentWidth / 2, -this.currentHeight / 2, this.currentWidth, this.currentHeight);
        } else {
            this.currentWidth = this.size; this.currentHeight = this.size;
            ctx.fillStyle = "#111"; ctx.strokeStyle = "#ff00ff"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, -this.size/2); ctx.lineTo(this.size/2, this.size/4); ctx.lineTo(-this.size/2, this.size/4); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        const hpPercentage = this.health / this.maxHealth; const barWidth = this.currentWidth * 0.8; const barHeight = Math.max(3, this.currentHeight * 0.05);
        ctx.fillStyle = "red"; ctx.fillRect(-barWidth/2, -this.currentHeight/2 - 25, barWidth, barHeight);
        ctx.fillStyle = "lime"; ctx.fillRect(-barWidth/2, -this.currentHeight/2 - 25, barWidth * hpPercentage, barHeight);
        ctx.restore();
    }
}

function init() {
    updateHeartsUI(); 
    for (let i = 0; i < 200; i++) { stars.push(new Star()); }
    animate(); spawnEnemies(); enemies.push(new Enemy(true)); 
}

function updateHeartsUI(didHeal = false) {
    const container = document.getElementById('hearts-container');
    let heartsHTML = '';
    for (let i = 0; i < maxLives; i++) { heartsHTML += (i < playerLives) ? `<span class="heart-full">♥</span>` : `<span class="heart-empty">♡</span>`; }
    container.innerHTML = heartsHTML;
    if (didHeal) {
        container.classList.remove('heal-flash'); void container.offsetWidth; container.classList.add('heal-flash');
    }
}

function spawnEnemies() {
    if (!isGameOver && !isPaused) {
        if (enemies.length < Math.floor(maxEnemiesOnScreen)) { enemies.push(new Enemy()); }
        spawnDelay = Math.max(2000, spawnDelay - 100); maxEnemiesOnScreen = Math.min(5, maxEnemiesOnScreen + 0.1); 
        spawnTimerId = setTimeout(spawnEnemies, spawnDelay); 
    }
}

function togglePause() {
    if (!gameStarted || isGameOver) return; 
    isPaused = !isPaused;
    if (isPaused) {
        pauseScreen.style.display = 'flex';
        document.body.classList.remove('game-active'); 
        clearTimeout(spawnTimerId); 
    } else {
        pauseScreen.style.display = 'none';
        document.body.classList.add('game-active'); 
        spawnEnemies(); 
        animate(); 
    }
}

function takeDamage(amount) {
    if (isGameOver) return; 

    playerHealth -= amount;
    if (playerHealth > 0 || playerLives > 1) {
        playAudio(damageSound);
    }
    
    document.getElementById('cockpit-layer').style.transform = "translate(10px, 10px)";
    damageFlash.style.display = "block";
    setTimeout(() => { document.getElementById('cockpit-layer').style.transform = "translate(0, 0)"; damageFlash.style.display = "none"; }, 80);

    if (playerHealth <= 0) {
        playerLives -= 1;
        updateHeartsUI();
        
        if (playerLives > 0) {
            healthBar.style.transition = 'none';
            playerHealth = 100;
            healthBar.style.width = '100%';
            healthBar.style.backgroundColor = '#00ff00'; 
            document.getElementById('health-container').style.borderColor = '#00ff00';
            
            void healthBar.offsetWidth;
            
            healthBar.style.transition = 'width 0.2s, background-color 0.2s';
            
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            enemies = enemies.filter(enemy => Math.hypot(enemy.x - cx, enemy.y - cy) > 400);
        } else {
            playerHealth = 0;
            if (!isGameOver) {
                isGameOver = true;
                playAudio(gameOverSound); 
                gameOverScreen.style.display = 'block';
                document.body.classList.remove('game-active'); 
            }
        }
    }
    
    healthBar.style.width = playerHealth + '%';
    if (playerHealth <= 30) {
        healthBar.style.backgroundColor = '#ff0000'; document.getElementById('health-container').style.borderColor = '#ff0000';
    } else {
        healthBar.style.backgroundColor = '#00ff00'; document.getElementById('health-container').style.borderColor = '#00ff00';
    }
}

function fireWeapon() {
    if (!gameStarted || isPaused || isGameOver) return; 
    playAudio(shootSound);
    
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    playerLasers.push({ alpha: 1 });

    enemies.forEach(enemy => {
        if (Math.hypot(cx - enemy.x, cy - enemy.y) < enemy.currentWidth / 1.5) { 
            enemy.health -= 50; 
            if (enemy.health <= 0) {
                enemy.markedForDeletion = true; score += 100; totalKills += 1; 
                scoreDisplay.innerText = score.toString().padStart(4, '0');
                
                if (totalKills % 15 === 0 && playerLives < maxLives) {
                    playerLives += 1; updateHeartsUI(true); 
                }
            }
        }
    });
}

function drawCrosshair() {
    const cx = uiCanvas.width / 2; const cy = uiCanvas.height / 2; const size = 20;
    
    uiCtx.save();
    uiCtx.shadowBlur = 15;
    uiCtx.shadowColor = "#00ff00";
    uiCtx.strokeStyle = "#00ff00"; 
    uiCtx.lineWidth = 3; 
    
    uiCtx.beginPath(); 
    uiCtx.moveTo(cx - size, cy); uiCtx.lineTo(cx + size, cy); 
    uiCtx.moveTo(cx, cy - size); uiCtx.lineTo(cx, cy + size); 
    uiCtx.arc(cx, cy, 10, 0, Math.PI * 2); 
    uiCtx.stroke();
    uiCtx.restore();
}

function drawIndicators() {
    const cx = uiCanvas.width / 2; const cy = uiCanvas.height / 2; const radius = Math.min(uiCanvas.width, uiCanvas.height) / 2 - 150; 
    enemies.forEach(enemy => {
        const dx = enemy.x - cx; const dy = enemy.y - cy;
        if (Math.hypot(dx, dy) > 150) {
            const angle = Math.atan2(dy, dx);
            uiCtx.save(); 
            uiCtx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius); 
            uiCtx.rotate(angle);
            
            uiCtx.fillStyle = "#ff0000"; 
            uiCtx.shadowBlur = 20; 
            uiCtx.shadowColor = "#ff0000"; 
            
            uiCtx.beginPath(); 
            uiCtx.moveTo(30, 0); 
            uiCtx.lineTo(-10, 15); 
            uiCtx.lineTo(-10, -15); 
            uiCtx.closePath(); 
            uiCtx.fill();
            uiCtx.restore();
        }
    });
}

window.addEventListener('mousedown', fireWeapon);
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); }
    if (e.code === 'Space') { if (gameStarted && !isPaused) e.preventDefault(); fireWeapon(); }
    if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.code)) { keys[e.key] = true; keys[e.code] = true; }
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.code)) { keys[e.key] = false; keys[e.code] = false; }
});

function animate() {
    if (isGameOver || !gameStarted || isPaused) { 
        if (gameStarted && !isPaused) requestAnimationFrame(animate); 
        return; 
    }
    let panX = 0; let panY = 0;
    if (keys.a || keys.ArrowLeft) panX = turnSpeed; if (keys.d || keys.ArrowRight) panX = -turnSpeed;
    if (keys.w || keys.ArrowUp) panY = turnSpeed; if (keys.s || keys.ArrowDown) panY = -turnSpeed;

    ctx.fillStyle = 'rgba(5, 5, 16, 0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    
    ctx.shadowBlur = 0; 
    
    stars.forEach(star => { star.update(panX, panY); star.draw(); });
    enemyLasers.forEach(laser => { laser.update(panX, panY); laser.draw(); }); enemyLasers = enemyLasers.filter(l => !l.markedForDeletion);
    enemies.forEach(enemy => { enemy.update(panX, panY); enemy.draw(); }); enemies = enemies.filter(e => !e.markedForDeletion);

    const cx = canvas.width / 2; const cy = canvas.height / 2;
    playerLasers.forEach((laser, index) => {
        ctx.strokeStyle = `rgba(0, 255, 0, ${laser.alpha})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(canvas.width * 0.2, canvas.height); ctx.lineTo(cx, cy); ctx.moveTo(canvas.width * 0.8, canvas.height); ctx.lineTo(cx, cy); ctx.stroke();
        laser.alpha -= 0.15; if (laser.alpha <= 0) playerLasers.splice(index, 1);
    });

    drawIndicators(); 
    drawCrosshair(); 
    
    requestAnimationFrame(animate);
}

ctx.fillStyle = 'rgba(5, 5, 16, 1)'; ctx.fillRect(0, 0, canvas.width, canvas.height);

window.addEventListener('resize', () => { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
    uiCanvas.width = window.innerWidth; 
    uiCanvas.height = window.innerHeight; 
});