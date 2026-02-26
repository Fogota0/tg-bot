const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const obstacleImages = [];

const potionImg = new Image();
potionImg.src = "assets/potion.png";

const bookImg = new Image();
bookImg.src = "assets/book.png";

const cauldronImg = new Image();
cauldronImg.src = "assets/cauldron.png";

// --- SNAPE IMAGES ---
const snapeRun1 = new Image();
snapeRun1.src = "assets/snape_run1.png";

const snapeRun2 = new Image();
snapeRun2.src = "assets/snape_run2.png";

const snapeJump = new Image();
snapeJump.src = "assets/snape_jump.png";

const snapeDead = new Image();
snapeDead.src = "assets/snape_dead.png";

let snapeFrame = 0;
let animationTimer = 0;
let animationSpeed = 20; // больше = медленнее переключение анимации

let time = 0;
let dayDuration = 2000; // сколько кадров длится цикл

let dayProgress = 0;      // 0 = день, 1 = ночь
let targetNight = false;  // к чему стремимся

let scale = 1;

obstacleImages.push(potionImg, bookImg, cauldronImg);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const baseHeight = 800;
  scale = canvas.height / baseHeight;

  snape.width = 120 * scale;
  snape.height = 190 * scale;

  snape.gravity = 0.8 * scale;   // ← ВОТ ТУТ
  snape.jumpPower = -18 * scale; // ← И ВОТ ТУТ

  snape.baseY = canvas.height - 70 * scale;
  snape.y = snape.baseY - snape.height;
}

const snape = {
  x: 100,
  y: 0,
  width: 160,
  height: 150,
  // визуальная подстройка: сдвигает спрайт вниз относительно физической позиции
  visualAdjust: 24,
  // флаги и параметры для смерти (подлёт/падение)
  deadInitiated: false,
  rotation: 0,
  rotationSpeed: 0,
  velocityY: 0,
  gravity: 0.5,
  jumpPower: -16,
  onGround: true
};

// (debug export removed)

window.addEventListener("resize", resize);

let startTimer = 0;
let startDelay = 120; // 120 кадров ≈ 2 секунды
let obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = 140 + Math.random() * 80;
 // чем меньше — тем сложнее
let gameSpeed = 4;



function drawBackground() {

  // плавное движение к цели
  if (targetNight && dayProgress < 1) {
    dayProgress += 0.003;
  } else if (!targetNight && dayProgress > 0) {
    dayProgress -= 0.003;
  }

  // интерполяция цвета
 const topDay = { r: 70, g: 120, b: 170 };
const bottomDay = { r: 120, g: 160, b: 190 };


  const topNight = { r: 15, g: 27, b: 46 };
  const bottomNight = { r: 28, g: 28, b: 46 };

  function lerp(a, b, t) {
    return Math.floor(a + (b - a) * t);
  }

  const r1 = lerp(topDay.r, topNight.r, dayProgress);
  const g1 = lerp(topDay.g, topNight.g, dayProgress);
  const b1 = lerp(topDay.b, topNight.b, dayProgress);

  const r2 = lerp(bottomDay.r, bottomNight.r, dayProgress);
  const g2 = lerp(bottomDay.g, bottomNight.g, dayProgress);
  const b2 = lerp(bottomDay.b, bottomNight.b, dayProgress);

  // Кешируем градиент только если dayProgress изменился
  if (Math.abs(lastDayProgress - dayProgress) > 0.01) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    gradient.addColorStop(1, `rgb(${r2},${g2},${b2})`);
    cachedGradient = gradient;
    lastDayProgress = dayProgress;
  }

  ctx.fillStyle = cachedGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}



function drawMoon() {
  if (dayProgress <= 0) return;

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = dayProgress;

  ctx.fillStyle = "rgba(255,255,220,0.95)";
  ctx.beginPath();
  ctx.arc(canvas.width - 120, 120, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = prevAlpha;
}

let clouds = [];
function createClouds() {
  clouds = [];

  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 50 + Math.random() * 150,
      size: 60 + Math.random() * 80,
      speed: 0.2 + Math.random() * 0.3
    });
  }
}
createClouds();


function drawClouds() {
  if (dayProgress >= 1) return; // ночью не рисуем

  // чем ближе к ночи — тем прозрачнее
  const alpha = 1 - dayProgress;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,255,255,0.8)";

  clouds.forEach(cloud => {
    cloud.x -= cloud.speed;

    if (cloud.x < -200) {
      cloud.x = canvas.width + 100;
      cloud.y = 50 + Math.random() * 150;
    }

    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.size * 0.4, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.4, cloud.y - 10, cloud.size * 0.5, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.8, cloud.y, cloud.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}


let stars = [];

function createStars() {
  stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6,
      size: Math.random() * 2,
      twinkleSpeed: 0.01 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2
    });

  }
}

createStars();

resize();

function drawStars() {
  
  if (dayProgress <= 0) return;

  // Упрощённая анимация мерцания - вместо performance.now()
  const twinkePhase = frameCount % 60;
  
  stars.forEach(star => {
    // Вместо Math.sin с performance.now() - простой расчёт
    const alpha =
      (0.5 + 0.5 * Math.sin((twinkePhase + star.phase) * 0.1))      
      * dayProgress;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "white";

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.globalAlpha = 1;
}



function drawGround() {
  const groundY = snape.baseY;

  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();
}
function createObstacle() {
  const randomImage =
    obstacleImages[Math.floor(Math.random() * obstacleImages.length)];

  // Упрощенная проверка загрузки
  if (!randomImage.complete) {
    obstacleTimer = obstacleInterval - 10;
    return;
  }

  // 🔥 ВОТ ЭТО МЕНЯЕМ
  const desiredHeight = (60 + Math.random() * 20) * scale;

  const ratio = randomImage.naturalWidth / randomImage.naturalHeight;

  const height = desiredHeight;
  const width = height * ratio;

  obstacles.push({
    x: canvas.width + 100 * scale,
    y: snape.baseY - height,
    width: width,
    height: height,
    image: randomImage
  });
}



function updateObstacles() {
  obstacleTimer++;

  if (startTimer < startDelay) {
  startTimer++;
  return;
}
  if (obstacleTimer > obstacleInterval) {
    createObstacle();
    obstacleInterval = 140 + Math.random() * 80;
    obstacleTimer = 0;
  }

  obstacles.forEach(obstacle => {
    obstacle.x -= gameSpeed;

  });

  obstacles = obstacles.filter(o => o.x + o.width > 0);
}

function drawObstacles() {
  obstacles.forEach(o => {

    const groundY = snape.baseY;

    // ТЕНЬ - упрощенно, без blur
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(
      o.x + o.width * 0.1,
      groundY - 4,
      o.width * 0.8,
      4
    );

    // САМО ИЗОБРАЖЕНИЕ
    ctx.drawImage(o.image, o.x, o.y, o.width, o.height);
  });
}




function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}


function jump() {
    
  if (gameOver) {
    resetGame();
    return;
    
  }

  if (snape.onGround) {
    snape.velocityY = snape.jumpPower * 0.82;
    snape.y -= 2;
    snape.onGround = false;
   
  }
}



window.addEventListener("mousedown", jump);
window.addEventListener("touchstart", jump);

function updateSnape() {
  // Гравитация 
  if (snape.deadInitiated) {
    // при смерти
    if (snape.velocityY < 0) {
      snape.velocityY += snape.gravity * 0.4;
    } else {
      snape.velocityY += snape.gravity * 0.6;
    }
  } else {
    if (!snape.onGround) {
      if (snape.velocityY < 0) {
        snape.velocityY += snape.gravity * 0.5; // более плавный подлёт
      } else {
        snape.velocityY += snape.gravity * 0.9; // более мягкое падение
      }
    }
  }

  // Ограничение скорости падения
  const maxFall = snape.deadInitiated ? 12 : 10;
  if (snape.velocityY > maxFall) {
    snape.velocityY = maxFall;
  }

  snape.y += snape.velocityY;

  const ground = snape.baseY || (snape.baseY);

  if (snape.y + snape.height >= ground) {
    snape.y = ground - snape.height;
    snape.velocityY = 0;
    snape.onGround = true;
  } else {
    snape.onGround = false;
  }

  // Если началась смерть
  if (snape.deadInitiated) {
    snape.rotation += snape.rotationSpeed;
    // скорость вращения со временем
    snape.rotationSpeed *= 0.995;
    return;
  }

  // АНИМАЦИЯ БЕГА
  if (snape.onGround && !gameOver) {
    animationTimer++;
    if (animationTimer >= animationSpeed) {
      snapeFrame = snapeFrame === 0 ? 1 : 0;
      animationTimer = 0;
    }
  }
}




function drawSnape() {
  let currentImage;

  if (gameOver) {
    currentImage = snapeDead;
  } else if (!snape.onGround) {
    currentImage = snapeJump;
  } else {
    currentImage = snapeFrame === 0 ? snapeRun1 : snapeRun2;
  }

  // Если персонаж в состоянии смерти
  if (snape.deadInitiated) {
    const cx = snape.x + snape.width / 2;
    const cy = snape.y + snape.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(snape.rotation);
    ctx.drawImage(currentImage, -snape.width / 2, -snape.height / 2, snape.width, snape.height);
    ctx.restore();
  } else {
    // обычная отрисовка без save/restore
    ctx.drawImage(currentImage, snape.x, snape.y + (snape.visualAdjust || 0), snape.width, snape.height);
  }
}

let score = 0;
let scoreTimer = 0;
let scoreInterval = 15; // кадров (15 ≈ 0.25 сек)

function updateScore() {
  if (startTimer < startDelay) return;

  scoreTimer++;

  if (scoreTimer >= scoreInterval) {
    score++;
    scoreTimer = 0;

    // ускорение
    if (score % 20 === 0) {
      gameSpeed += 0.15;
    }
  }
if (score % 250 === 0 && score !== 0) {
  targetNight = !targetNight;
}


}





function drawScore() {
  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Arial";
  ctx.fillText(`Очки: ${score}`, 20, 40);
}



let gameOver = false;
function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("ПРОИГРАЛ", canvas.width / 2, canvas.height / 2);

  ctx.font = "24px Arial";
  ctx.fillText("нажми", canvas.width / 2, canvas.height / 2 + 40);
}

function resetGame() {
    
  obstacles = [];
startTimer = 0;
gameSpeed = 3.5;
  score = 0;
  scoreTimer = 0;
  obstacleTimer = 0;
  gameOver = false;
snapeFrame = 0;
animationTimer = 0;
  // вернуть на линию земли и сбросить состояние смерти
  snape.y = (snape.baseY || (snape.baseY)) - snape.height;
  snape.velocityY = 0;
  snape.onGround = true;
  snape.deadInitiated = false;
  snape.rotation = 0;
  snape.rotationSpeed = 0;
}

let lastTime = 0;
const fps = 60;
const interval = 1000 / fps;
let frameCount = 0;

// Кеш для градиента и звёзд
let cachedGradient = null;
let lastDayProgress = -1;
let starFrameCache = null;

function gameLoop(currentTime) {
  requestAnimationFrame(gameLoop);

  if (currentTime - lastTime < interval) return;
  lastTime = currentTime;

  frameCount++;

  // ---- ЛОГИКА ----
  updateSnape();

  if (!gameOver) {
    updateObstacles();
    updateScore();

    obstacles.forEach(o => {
      if (checkCollision(snape, o)) {
        gameOver = true;

        if (!snape.deadInitiated) {
          snape.deadInitiated = true;
          snape.velocityY = -10;
          snape.onGround = false;
          snape.rotationSpeed = 0.08;
        }
      }
    });
  }

  // ---- ОТРИСОВКА ----
  drawBackground();
  drawClouds();
  drawStars();
  drawMoon();
  drawGround();
  drawSnape();
  drawObstacles();
  drawScore();

  if (gameOver) {
    drawGameOver();
  }
}

requestAnimationFrame(gameLoop);

// 60 кадрвв = 1 секунды


