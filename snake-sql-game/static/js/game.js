class SnakeSQLGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        this.tileCount = this.canvas.width / this.gridSize;
        
        this.snake = [];
        this.snake[0] = { x: 10, y: 10 };
        
        this.food = {};
        this.direction = 'right';
        this.gameRunning = false;
        this.gamePaused = false; // NEW: Track pause state separately
        this.gameLoop = null;
        this.score = 0;
        this.level = 1;
        
        this.currentQuestion = null;
        this.lockedFood = null;
        
        this.initializeEventListeners();
        this.showStartScreen();
    }

    initializeEventListeners() {
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
        document.getElementById('submitQuery').addEventListener('click', this.submitQuery.bind(this));
        document.getElementById('skipQuestion').addEventListener('click', this.skipQuestion.bind(this));
        document.getElementById('restartGame').addEventListener('click', this.restartGame.bind(this));
    }

    handleKeyPress(event) {
        if (!this.gameRunning || this.gamePaused) return;

        const key = event.key;
        switch(key) {
            case 'ArrowUp':
                if (this.direction !== 'down') this.direction = 'up';
                break;
            case 'ArrowDown':
                if (this.direction !== 'up') this.direction = 'down';
                break;
            case 'ArrowLeft':
                if (this.direction !== 'right') this.direction = 'left';
                break;
            case 'ArrowRight':
                if (this.direction !== 'left') this.direction = 'right';
                break;
        }
    }

    showStartScreen() {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Press SPACE to start', this.canvas.width / 2, this.canvas.height / 2);
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.gameRunning) {
                this.startGame();
            }
        });
    }

    startGame() {
        this.snake = [{ x: 10, y: 10 }];
        this.direction = 'right';
        this.score = 0;
        this.level = 1;
        this.gameRunning = true;
        this.gamePaused = false; // NEW: Reset pause state
        this.updateScore();
        this.generateFood();
        this.runGame();
    }

    runGame() {
        if (this.gameLoop) clearInterval(this.gameLoop);
        
        const speed = 150 - (this.level * 10);
        this.gameLoop = setInterval(() => {
            if (!this.gamePaused) { // NEW: Only update if not paused
                this.update();
                this.draw();
            }
        }, Math.max(speed, 50));
    }

    update() {
        const head = { ...this.snake[0] };
        
        switch(this.direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }
        
        // Wall collision
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this.gameOver();
            return;
        }
        
        // Self collision
        for (let segment of this.snake) {
            if (head.x === segment.x && head.y === segment.y) {
                this.gameOver();
                return;
            }
        }
        
        this.snake.unshift(head);
        
        // Check for food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            if (this.lockedFood && head.x === this.lockedFood.x && head.y === this.lockedFood.y) {
                this.triggerSQLChallenge();
            } else {
                this.eatFood();
            }
        } else {
            this.snake.pop();
        }
    }

    // NEW: Separate method for eating regular food
    eatFood() {
        this.score++;
        this.updateScore();
        this.generateFood();
        
        // Level up every 5 points
        if (this.score % 5 === 0) {
            this.level++;
            this.runGame(); // Adjust speed for new level
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw snake
        this.ctx.fillStyle = 'lime';
        for (let segment of this.snake) {
            this.ctx.fillRect(segment.x * this.gridSize, segment.y * this.gridSize, this.gridSize - 2, this.gridSize - 2);
        }
        
        // Draw food
        if (this.food.x !== undefined && this.food.y !== undefined) {
            if (this.lockedFood && this.food.x === this.lockedFood.x && this.food.y === this.lockedFood.y) {
                this.ctx.fillStyle = 'gray'; // Locked food
            } else {
                this.ctx.fillStyle = 'red'; // Regular food
            }
            this.ctx.fillRect(this.food.x * this.gridSize, this.food.y * this.gridSize, this.gridSize - 2, this.gridSize - 2);
        }
    }

    generateFood() {
        let newFood;
        let onSnake;
        
        do {
            newFood = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
            
            onSnake = this.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
        } while (onSnake);
        
        this.food = newFood;
        
        // Randomly lock food for SQL challenges (30% chance)
        if (Math.random() < 0.3) {
            this.lockedFood = { ...newFood };
        } else {
            this.lockedFood = null;
        }
    }

    triggerSQLChallenge() {
        this.pauseGame();
        this.fetchQuestion();
    }

    async fetchQuestion() {
        try {
            const response = await fetch('/api/question/random');
            const question = await response.json();
            
            if (!question.error) {
                this.currentQuestion = question;
                this.showSQLModal(question);
            } else {
                // If there's an error fetching question, unlock the food
                console.error('Error fetching question:', question.error);
                this.unlockFood();
            }
        } catch (error) {
            console.error('Error fetching question:', error);
            this.unlockFood(); // Unlock food if there's an error
        }
    }

    showSQLModal(question) {
        const modal = document.getElementById('sqlModal');
        const questionText = document.getElementById('questionText');
        const sqlInput = document.getElementById('sqlInput');
        const feedback = document.getElementById('feedback');
        
        questionText.textContent = question.question;
        sqlInput.value = '';
        feedback.textContent = '';
        feedback.className = 'feedback';
        
        modal.style.display = 'block';
        sqlInput.focus();
    }

    async submitQuery() {
        if (!this.currentQuestion) return;
        
        const sqlInput = document.getElementById('sqlInput');
        const userQuery = sqlInput.value.trim();
        const feedback = document.getElementById('feedback');
        
        if (!userQuery) {
            feedback.textContent = 'Please enter an SQL query';
            feedback.className = 'feedback error';
            return;
        }
        
        try {
            const response = await fetch('/api/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: userQuery,
                    question_id: this.currentQuestion.id
                })
            });
            
            const result = await response.json();
            
            if (result.valid) {
                feedback.textContent = 'Correct! Food unlocked!';
                feedback.className = 'feedback success';
                
                // Wait a moment to show success message, then proceed
                setTimeout(() => {
                    this.hideSQLModal();
                    this.processCorrectAnswer();
                }, 1500);
            } else {
                feedback.textContent = `Incorrect. Expected: ${result.expected}`;
                feedback.className = 'feedback error';
                // Don't hide modal - let user try again
            }
        } catch (error) {
            console.error('Error validating query:', error);
            feedback.textContent = 'Error validating query. Please try again.';
            feedback.className = 'feedback error';
        }
    }

    // NEW: Separate method for processing correct answers
    processCorrectAnswer() {
        this.lockedFood = null; // Remove the lock
        this.resumeGame();
        
        // Eat the food and continue
        this.score++;
        this.updateScore();
        this.generateFood();
        
        if (this.score % 5 === 0) {
            this.level++;
            this.runGame();
        }
    }

    skipQuestion() {
        this.hideSQLModal();
        this.generateFood(); // Generate new food instead of unlocking current
        this.resumeGame();
    }

    hideSQLModal() {
        document.getElementById('sqlModal').style.display = 'none';
        this.currentQuestion = null;
    }

    pauseGame() {
        this.gamePaused = true;
    }

    resumeGame() {
        this.gamePaused = false;
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
    }

    gameOver() {
        this.gameRunning = false;
        this.gamePaused = false;
        clearInterval(this.gameLoop);
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverModal').style.display = 'block';
        
        // Send stats to server
        this.updateStats();
    }

    async updateStats() {
        try {
            await fetch('/api/stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: 'player',
                    score: this.score,
                    questions_answered: 1,
                    correct_answers: 1
                })
            });
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    restartGame() {
        document.getElementById('gameOverModal').style.display = 'none';
        this.hideSQLModal(); // Ensure SQL modal is also hidden
        this.startGame();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SnakeSQLGame();
});