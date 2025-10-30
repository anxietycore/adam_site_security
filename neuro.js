// NEURO PIZDEC - Живой нейро-фон A.D.A.M.
class NeuroBackground {
    constructor() {
        this.canvas = document.getElementById('neuroCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        this.opts = {
            // Структура мозга
            range: 220,
            baseConnections: 4,
            addedConnections: 6,
            baseSize: 6,
            minSize: 1.5,
            dataToConnectionSize: .3,
            sizeMultiplier: .65,
            allowedDist: 45,
            baseDist: 35,
            addedDist: 25,
            connectionAttempts: 150,
            
            // Импульсы
            dataToConnections: 2,
            baseSpeed: .03,
            addedSpeed: .04,
            baseGlowSpeed: .3,
            addedGlowSpeed: .5,
            
            // Вращение
            rotVelX: .0015,
            rotVelY: .001,
            
            // Цвета A.D.A.M.
            repaintColor: 'rgba(5, 15, 5, 0.3)',
            connectionColor: 'hsla(160, 70%, light%, alp)',
            rootColor: 'hsla(140, 90%, light%, alp)',
            endColor: 'hsla(120, 50%, light%, alp)',
            dataColor: 'hsla(80, 100%, light%, alp)',
            
            wireframeWidth: .2,
            wireframeColor: 'rgba(100, 255, 130, 0.1)',
            
            depth: 300,
            focalLength: 280,
            vanishPoint: { x: 0, y: 0 }
        };
        
        this.squareRange = this.opts.range * this.opts.range;
        this.squareAllowed = this.opts.allowedDist * this.opts.allowedDist;
        this.mostDistant = this.opts.depth + this.opts.range;
        
        this.sinX = this.sinY = 0;
        this.cosX = this.cosY = 0;
        
        this.connections = [];
        this.toDevelop = [];
        this.data = [];
        this.all = [];
        this.tick = 0;
        
        this.animating = false;
        this.Tau = Math.PI * 2;

        this.init();
        this.startAnimation();
        
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.opts.vanishPoint.x = this.canvas.width / 2;
        this.opts.vanishPoint.y = this.canvas.height / 2;
        
        if (this.ctx) {
            this.ctx.fillStyle = '#050f05';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    init() {
        this.connections = [];
        this.data = [];
        this.all = [];
        this.toDevelop = [];
        
        // Создаем корневой узел (центр мозга)
        let connection = new NeuroConnection(this, 0, 0, 0, this.opts.baseSize);
        connection.step = NeuroConnection.rootStep;
        this.connections.push(connection);
        this.all.push(connection);
        connection.link();
        
        // Разрастаем нейронную сеть
        while (this.toDevelop.length > 0) {
            this.toDevelop[0].link();
            this.toDevelop.shift();
        }
    }
    
    startAnimation() {
        if (!this.animating) {
            this.animating = true;
            this.animate();
        }
    }
    
    animate() {
        if (!this.animating) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Очистка с лёгким затемнением для следов
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.fillStyle = this.opts.repaintColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.tick++;
        
        // Вращение
        let rotX = this.tick * this.opts.rotVelX;
        let rotY = this.tick * this.opts.rotVelY;
        
        this.cosX = Math.cos(rotX);
        this.sinX = Math.sin(rotX);
        this.cosY = Math.cos(rotY);
        this.sinY = Math.sin(rotY);
        
        // Добавляем импульсы
        if (this.data.length < this.connections.length * this.opts.dataToConnections) {
            let datum = new NeuroData(this, this.connections[0]);
            this.data.push(datum);
            this.all.push(datum);
        }
        
        // Рисуем связи
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.beginPath();
        this.ctx.lineWidth = this.opts.wireframeWidth;
        this.ctx.strokeStyle = this.opts.wireframeColor;
        
        this.all.forEach(item => item.step());
        this.ctx.stroke();
        
        // Рисуем узлы и импульсы
        this.ctx.globalCompositeOperation = 'source-over';
        this.all.sort((a, b) => b.screen.z - a.screen.z);
        this.all.forEach(item => item.draw());
    }
    
    // Для синхронизации с деградацией (добавим позже)
    setDegradation(level) {
        // Будем менять параметры в зависимости от уровня деградации
        this.opts.rotVelX = 0.0015 + (level / 100) * 0.003;
        this.opts.rotVelY = 0.001 + (level / 100) * 0.002;
    }
}

class NeuroConnection {
    constructor(neuro, x, y, z, size) {
        this.neuro = neuro;
        this.x = x;
        this.y = y;
        this.z = z;
        this.size = size;
        
        this.screen = {};
        this.links = [];
        this.isEnd = false;
        this.glowSpeed = neuro.opts.baseGlowSpeed + neuro.opts.addedGlowSpeed * Math.random();
    }
    
    link() {
        if (this.size < this.neuro.opts.minSize) {
            this.isEnd = true;
            return;
        }
        
        let links = [];
        let connectionsNum = this.neuro.opts.baseConnections + Math.random() * this.neuro.opts.addedConnections | 0;
        let attempt = this.neuro.opts.connectionAttempts;
        
        while (links.length < connectionsNum && --attempt > 0) {
            let alpha = Math.random() * Math.PI;
            let beta = Math.random() * this.neuro.Tau;
            let len = this.neuro.opts.baseDist + this.neuro.opts.addedDist * Math.random();
            
            let cosA = Math.cos(alpha);
            let sinA = Math.sin(alpha);
            let cosB = Math.cos(beta);
            let sinB = Math.sin(beta);
            
            let pos = {
                x: this.x + len * cosA * sinB,
                y: this.y + len * sinA * sinB,
                z: this.z + len * cosB
            };
            
            if (pos.x * pos.x + pos.y * pos.y + pos.z * pos.z < this.neuro.squareRange) {
                let passedExisting = true;
                let passedBuffered = true;
                
                for (let i = 0; i < this.neuro.connections.length; i++) {
                    if (this.squareDist(pos, this.neuro.connections[i]) < this.neuro.squareAllowed) {
                        passedExisting = false;
                    }
                }
                
                if (passedExisting) {
                    for (let i = 0; i < links.length; i++) {
                        if (this.squareDist(pos, links[i]) < this.neuro.squareAllowed) {
                            passedBuffered = false;
                        }
                    }
                }
                
                if (passedExisting && passedBuffered) {
                    links.push(pos);
                }
            }
        }
        
        if (links.length === 0) {
            this.isEnd = true;
        } else {
            for (let i = 0; i < links.length; i++) {
                let pos = links[i];
                let connection = new NeuroConnection(this.neuro, pos.x, pos.y, pos.z, this.size * this.neuro.opts.sizeMultiplier);
                
                this.links[i] = connection;
                this.neuro.all.push(connection);
                this.neuro.connections.push(connection);
            }
            
            for (let i = 0; i < this.links.length; i++) {
                this.neuro.toDevelop.push(this.links[i]);
            }
        }
    }
    
    step() {
        this.setScreen();
        let light = 30 + ((this.neuro.tick * this.glowSpeed) % 30);
        let alp = 0.2 + (1 - this.screen.z / this.neuro.mostDistant) * 0.8;
        this.screen.color = (this.isEnd ? this.neuro.opts.endColor : this.neuro.opts.connectionColor)
            .replace('light', light)
            .replace('alp', alp);
        
        for (let i = 0; i < this.links.length; i++) {
            this.neuro.ctx.moveTo(this.screen.x, this.screen.y);
            this.neuro.ctx.lineTo(this.links[i].screen.x, this.links[i].screen.y);
        }
    }
    
    static rootStep() {
        this.setScreen();
        let light = 30 + ((this.neuro.tick * this.glowSpeed) % 30);
        let alp = (1 - this.screen.z / this.neuro.mostDistant) * 0.8;
        this.screen.color = this.neuro.opts.rootColor
            .replace('light', light)
            .replace('alp', alp);
        
        for (let i = 0; i < this.links.length; i++) {
            this.neuro.ctx.moveTo(this.screen.x, this.screen.y);
            this.neuro.ctx.lineTo(this.links[i].screen.x, this.links[i].screen.y);
        }
    }
    
    draw() {
        this.neuro.ctx.fillStyle = this.screen.color;
        this.neuro.ctx.beginPath();
        this.neuro.ctx.arc(this.screen.x, this.screen.y, this.screen.scale * this.size, 0, this.neuro.Tau);
        this.neuro.ctx.fill();
    }
    
    setScreen() {
        let x = this.x, y = this.y, z = this.z;
        
        // Вращение по X
        let Y = y;
        y = y * this.neuro.cosX - z * this.neuro.sinX;
        z = z * this.neuro.cosX + Y * this.neuro.sinX;
        
        // Вращение по Y
        let Z = z;
        z = z * this.neuro.cosY - x * this.neuro.sinY;
        x = x * this.neuro.cosY + Z * this.neuro.sinY;
        
        this.screen.z = z;
        z += this.neuro.opts.depth;
        
        this.screen.scale = this.neuro.opts.focalLength / z;
        this.screen.x = this.neuro.opts.vanishPoint.x + x * this.screen.scale;
        this.screen.y = this.neuro.opts.vanishPoint.y + y * this.screen.scale;
    }
    
    squareDist(a, b) {
        let x = b.x - a.x, y = b.y - a.y, z = b.z - a.z;
        return x * x + y * y + z * z;
    }
}

class NeuroData {
    constructor(neuro, connection) {
        this.neuro = neuro;
        this.glowSpeed = neuro.opts.baseGlowSpeed + neuro.opts.addedGlowSpeed * Math.random();
        this.speed = neuro.opts.baseSpeed + neuro.opts.addedSpeed * Math.random();
        this.screen = {};
        this.setConnection(connection);
    }
    
    setConnection(connection) {
        if (connection.isEnd) {
            this.reset();
        } else {
            this.connection = connection;
            this.nextConnection = connection.links[Math.floor(Math.random() * connection.links.length)];
            
            this.ox = connection.x;
            this.oy = connection.y;
            this.oz = connection.z;
            this.os = connection.size;
            
            this.nx = this.nextConnection.x;
            this.ny = this.nextConnection.y;
            this.nz = this.nextConnection.z;
            this.ns = this.nextConnection.size;
            
            this.dx = this.nx - this.ox;
            this.dy = this.ny - this.oy;
            this.dz = this.nz - this.oz;
            this.ds = this.ns - this.os;
            
            this.proportion = 0;
        }
    }
    
    reset() {
        this.setConnection(this.neuro.connections[0]);
        this.ended = 2;
    }
    
    step() {
        this.proportion += this.speed;
        
        if (this.proportion < 1) {
            this.x = this.ox + this.dx * this.proportion;
            this.y = this.oy + this.dy * this.proportion;
            this.z = this.oz + this.dz * this.proportion;
            this.size = (this.os + this.ds * this.proportion) * this.neuro.opts.dataToConnectionSize;
        } else {
            this.setConnection(this.nextConnection);
        }
        
        this.screen.lastX = this.screen.x;
        this.screen.lastY = this.screen.y;
        this.setScreen();
        
        let light = 40 + ((this.neuro.tick * this.glowSpeed) % 50);
        let alp = 0.2 + (1 - this.screen.z / this.neuro.mostDistant) * 0.6;
        this.screen.color = this.neuro.opts.dataColor
            .replace('light', light)
            .replace('alp', alp);
    }
    
    draw() {
        if (this.ended) {
            this.ended--;
            return;
        }
        
        this.neuro.ctx.beginPath();
        this.neuro.ctx.strokeStyle = this.screen.color;
        this.neuro.ctx.lineWidth = this.size * this.screen.scale;
        this.neuro.ctx.moveTo(this.screen.lastX, this.screen.lastY);
        this.neuro.ctx.lineTo(this.screen.x, this.screen.y);
        this.neuro.ctx.stroke();
    }
    
    setScreen() {
        let x = this.x, y = this.y, z = this.z;
        
        // Вращение по X
        let Y = y;
        y = y * this.neuro.cosX - z * this.neuro.sinX;
        z = z * this.neuro.cosX + Y * this.neuro.sinX;
        
        // Вращение по Y
        let Z = z;
        z = z * this.neuro.cosY - x * this.neuro.sinY;
        x = x * this.neuro.cosY + Z * this.neuro.sinY;
        
        this.screen.z = z;
        z += this.neuro.opts.depth;
        
        this.screen.scale = this.neuro.opts.focalLength / z;
        this.screen.x = this.neuro.opts.vanishPoint.x + x * this.screen.scale;
        this.screen.y = this.neuro.opts.vanishPoint.y + y * this.screen.scale;
    }
}

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', () => {
    new NeuroBackground();
});
