const car1 = document.getElementById("car1");
const car2 = document.getElementById("car2");
const car2_img = document.getElementById("car2_img");
const car1_img = document.getElementById("car1_img");
const control_board = document.getElementById("control-board");
const controller = document.getElementById("controller");
const tyres = document.getElementById("tyres");
const player1_score = document.getElementById("player1_score");
const player2_score = document.getElementById("player2_score");
const start_btn = document.getElementById("start_btn");
const socket = io();

socket.emit("joinRoom", roomCode);

let state = {
    mousedown: false
}

let maxSpeed = 4;
let game_started = false;
let running_game;
let rounds_to_win = 3;
let lastSyncTime = 0;
let syncInterval = 50;

function updateCarPosition(car) {
    car.style.left = `${car.leftPercent}%`;
    car.style.top = `${car.topPercent}%`;
}

function set_initial_values(car, car_img) {
    car.vertical = 0;
    car.horizontal = 0;

    car.quadrant_completed = {
        first: false, second: false, third: false, fourth: false,
    };
    car.score = 0;
    player1_score.innerText = 0;
    player2_score.innerText = 0;

    let leftPercent = (car === car1)
        ? ((window.innerWidth / 2) - 93) / window.innerWidth * 100
        : ((window.innerWidth / 2) - 63) / window.innerWidth * 100;

    car.leftPercent = leftPercent;
    car.topPercent = 50;

    updateCarPosition(car);
    car_img.style.transform = `rotateZ(0deg)`;
}

set_initial_values(car1, car1_img);
set_initial_values(car2, car2_img);

car1.player = 1;
car2.player = 2;

let control_board_coordinates = control_board.getBoundingClientRect();
let controller_coordinates = controller.getBoundingClientRect();
let range_overall = (control_board_coordinates.width / 2) - (controller_coordinates.width / 2);
let tyres_coordinates = tyres.getBoundingClientRect();

function updateCoordinates() {
    control_board_coordinates = control_board.getBoundingClientRect();
    controller_coordinates = controller.getBoundingClientRect();
    range_overall = (control_board_coordinates.width / 2) - (controller_coordinates.width / 2);
    tyres_coordinates = tyres.getBoundingClientRect();
}

function handleResize() {
    updateCoordinates();
    if (!game_started) {
        updateCarPosition(car1);
        updateCarPosition(car2);
    }
}

window.addEventListener('resize', handleResize);

// ===========================
// Game Logic
// ===========================
if (main_car.player == 1) {
    start_btn.classList += " player1";
    control_board.classList += " player1";
} else {
    start_btn.classList += " player2";
    control_board.classList += " player2";
}

start_btn.addEventListener("click", (e) => {
    if (start_btn.innerText === "Ready") {
        window.addEventListener('mousedown', start);
        window.addEventListener('mousemove', controller_fun);
        window.addEventListener('mouseup', end);
        window.addEventListener('touchstart', start);
        window.addEventListener('touchmove', controller_fun);
        window.addEventListener('touchend', end);
        socket.emit("ready");
    }
});

let secondary_car = main_car.player == 1 ? car2 : car1;

function gameEngine() {
    function rotateCar(car, car_img) {
        if (car.horizontal === 0 && car.vertical === 0) return 0;
        let ratio = car.horizontal / car.vertical;
        let radian = Math.atan(ratio);
        let deg = radian * (180 / Math.PI);
        if (isNaN(deg)) deg = 0;

        if (car.vertical > 0) car_img.style.transform = `rotateZ(${deg}deg)`;
        else if (car.vertical < 0) {
            car_img.style.transform = `rotateZ(${deg + 180}deg)`;
            deg += 180;
        } else car_img.style.transform = `rotateZ(${deg}deg)`;

        return deg;
    }

    const car1_rotation = rotateCar(car1, car1_img);
    const car2_rotation = rotateCar(car2, car2_img);
    const main_car_rotation = main_car.player === 1 ? car1_rotation : car2_rotation;

    function moveCar(car) {
        const moveX = (car.horizontal * maxSpeed) / window.innerWidth * 100;
        const moveY = (car.vertical * maxSpeed) / window.innerHeight * 100;

        car.leftPercent += moveX;
        car.topPercent -= moveY;

        // Clamp to window bounds
        if (car.leftPercent < 0) car.leftPercent = 0;
        if (car.leftPercent > 100) car.leftPercent = 100;
        if (car.topPercent < 0) car.topPercent = 0;
        if (car.topPercent > 100) car.topPercent = 100;

        updateCarPosition(car);

        car.coordinates = car.getBoundingClientRect();
    }

    moveCar(car1);
    moveCar(car2);

    function score(car) {
        if (in_upside_of_tyre(car)) {
            if (in_left_of_tyre(car)) {
                if (car.quadrant_completed.fourth) {
                    car.score++;
                    car.quadrant_completed.fourth = false;
                    if (car.player === 1) player1_score.innerText = car.score;
                    else player2_score.innerText = car.score;
                    if (car.score >= rounds_to_win) socket.emit("win", car.player);
                }
                car.quadrant_completed.first = true;
                car.quadrant_completed.second = false;
            } else {
                car.quadrant_completed.second = true;
                car.quadrant_completed.first = false;
                car.quadrant_completed.third = false;
            }
        } else {
            if (in_left_of_tyre(car)) {
                if (car.quadrant_completed.third) {
                    car.quadrant_completed.fourth = true;
                    car.quadrant_completed.third = false;
                }
            } else {
                car.quadrant_completed.third = true;
                car.quadrant_completed.second = false;
                car.quadrant_completed.fourth = false;
            }
        }
    }

    score(car1);
    score(car2);

    const currentTime = Date.now();
    if (game_started && currentTime - lastSyncTime >= syncInterval) {
        socket.emit("myCar", {
            horizontal: main_car.horizontal,
            vertical: main_car.vertical,
            position: {
                leftPercent: main_car.leftPercent,
                topPercent: main_car.topPercent
            },
            rotation: main_car_rotation,
            score: main_car.score
        });
        lastSyncTime = currentTime;
    }

    if (game_started) requestAnimationFrame(gameEngine);
}

function start(event) {
    event.preventDefault();
    state.mousedown = true;
    controller_fun(event);
}

function end(event) {
    event.preventDefault();
    state.mousedown = false;
    controller.style.left = `0px`;
    controller.style.top = `0px`;
    main_car.horizontal = 0;
    main_car.vertical = 0;

    socket.emit("myCar", {
        horizontal: 0,
        vertical: 0
    });
}

function controller_fun(event) {
    if (state.mousedown) {
        const clientX = event.clientX || event.touches[0].clientX;
        const clientY = event.clientY || event.touches[0].clientY;

        let offsetX = clientX - window.innerWidth / 2;
        let offsetY = clientY - control_board_coordinates.y - control_board_coordinates.height / 2;

        let rangeX = offsetX / (control_board_coordinates.width / 2);
        let rangeY = offsetY / (control_board_coordinates.height / 2);
        if (rangeX > 1) rangeX = 1;
        if (rangeY > 1) rangeY = 1;
        if (rangeX < -1) rangeX = -1;
        if (rangeY < -1) rangeY = -1;

        controller.style.left = `${rangeX * range_overall}px`;
        controller.style.top = `${rangeY * range_overall}px`;

        main_car.horizontal = rangeX;
        main_car.vertical = -rangeY;
    }
}

// ===========================
// Collision Detection
// ===========================
function in_x_range_tyre(car, margin) {
    return (car.coordinates.x > (tyres_coordinates.x - tyres_coordinates.width - margin)
        && car.coordinates.x < (tyres_coordinates.x + tyres_coordinates.width + margin));
}

function in_y_range_tyre(car, margin) {
    return (car.coordinates.y < (tyres_coordinates.y + tyres_coordinates.height - margin)
        && car.coordinates.y > (tyres_coordinates.y - car.coordinates.height + margin));
}

function in_left_of_tyre(car) {
    return (car.coordinates.x < tyres_coordinates.x - (tyres_coordinates.width / 2));
}

function in_upside_of_tyre(car) {
    return (car.coordinates.y < tyres_coordinates.y + (tyres_coordinates.height / 2));
}

// ===========================
// Socket Handlers
// ===========================
socket.on("wait", () => {
    start_btn.innerText = "Waiting for other player..."
});

socket.on("updateCar", data => {
    secondary_car.horizontal = data.horizontal;
    secondary_car.vertical = data.vertical;

    if (data.position) {
        secondary_car.leftPercent = data.position.leftPercent;
        secondary_car.topPercent = data.position.topPercent;
        updateCarPosition(secondary_car);
    }

    if (data.rotation !== undefined) {
        const img = secondary_car.player === 1 ? car1_img : car2_img;
        img.style.transform = `rotateZ(${data.rotation}deg)`;
    }

    if (data.score !== undefined) {
        secondary_car.score = data.score;
        if (secondary_car.player === 1) player1_score.innerText = data.score;
        else player2_score.innerText = data.score;
    }
});

socket.on("playerJoined", (playerNumber) => {
    console.log(`Player ${playerNumber} joined the room`);
});

socket.on("roomReady", () => {
    console.log("Room is ready");
    if (start_btn.innerText === "Waiting for other player...") {
        start_btn.innerText = "Ready";
    }
});

socket.on("playerLeft", () => {
    console.log(`A player left`);
    start_btn.innerText = "Waiting for other player...";
    game_started = false;
    if (running_game) cancelAnimationFrame(running_game);
});

socket.on("error", (message) => {
    alert(message);
    window.location.href = "/";
});

socket.on("game_start", game_start);
socket.on("restart_game", restart_game);

function game_start() {
    start_btn.style.display = "none";
    const timmer = document.getElementById("timmer");
    timmer.style.display = "inline";
    timmer.className = "timmer";
    game_started = true;
    timmer.innerText = "3";
    setTimeout(() => {
        timmer.innerText = "2";
        setTimeout(() => {
            timmer.innerText = "1";
            setTimeout(() => {
                timmer.innerText = "start";
                setTimeout(() => {
                    timmer.style.display = "none";
                    timmer.className = "";
                    running_game = requestAnimationFrame(gameEngine);
                }, 500);
            }, 1000);
        }, 1000);
    }, 1000);
}

function restart_game(winner) {
    cancelAnimationFrame(running_game);
    game_started = false;
    set_initial_values(car1, car1_img);
    set_initial_values(car2, car2_img);
    start_btn.innerText = main_car.player === winner
        ? "You Won !!! Click to play again"
        : "You Lost !!! Click to play again";
    start_btn.style.display = "block";
}

window.addEventListener("load", () => {
    start_btn.style.display = 'inline-block';
    start_btn.innerText = "Waiting for other player...";
});