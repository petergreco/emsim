/**
 * canvas.js
 * The main canvas drawing javascript, simulates a quick few frames of electrons and protons in free space
 * This is not accurate and only serves as a demonstration of what javascript can do with a few optimisations
 *
 * TODO: Fix the drawing of paths as the approach the edge of the canvas (cuts off way to early)
 * TODO: Fix the drawing of paths such that the direction is evident in the path tracing (perpendicular path lines)
 * TODO: Perform some benchmarking to demonstrate how effect the optimisations are
 * TODO: Document the code properly
 * TODO: Tidy up the code and remove any redundant variables
 * TODO: Add a 3D rotation of camera (need to implement more 3D soft engine)
 * TODO: 3d clipping
 * TODO: Auto stepping of simulation dependant on resultion of canvas
 */

//Get the canvas object and store it for access, this is where everything happens
var canvas = document.querySelector('canvas');

//Set the canvas to fill the screen
//canvas.width = window.innerWidth;
//canvas.height = window.innerHeight;

//Get the canvas Context obejct, this is the object we call the methods to draw onto the canvas
var c = canvas.getContext('2d');
var canvasWidth = canvas.width;
var canvasHeight = canvas.height;
var canvasDepth = 1000;
var canvasDepthMin = 10000;
//Setup the simulation interface and get ready to commence simulation
var viewportWidth = canvas.width;
var viewportHeight = canvas.height;
var viewportChangeRate = 0;
var maxParticleX = 0;
var minParticleX = 0;
var maxParticleY = 0;
var minParticleY = 0;
var viewportYZero = 0;
var viewportXZero = 0;
var tempMaxX = canvasWidth;
var tempMinX = 0;
var tempMaxY = canvasHeight;
var tempMinY = 0;
var viewportXBuffer = 50;
var viewportYBuffer = 50;
var viewportBufferPercent = 2;

//var simWindowResolution = 4;	//The resolution of the simulation, the higher the number the lower the resolution. Use this to keep the simulation smooth and reduce overhead

//Here you can control the simluation properties
var simTimeStep = 0.00001;			//The size of each simulation step: TODO:Automate this for smoother animations
var simTotalTime = 0.0;			//We need to keep track of the total time past through each simulation step
var columbsConstant = 8987551787.3681764;
var simChargeUnit = 0.00005;
var simStopTime = 0.006;

//Simulation frame rate control
var fps = 10;
var interval = 1000/fps;
var now;
var then = Date.now();
var delta;

function Particle() {
	this.x = 0;
	this.y = 0;
	this.z = 0;
	this.position = new Vector();
	this.charge = 0;
	this.velocity = new Vector();
	this.mass = 0;
	this.instantaneousForce = new Vector();
	this.dynamic = true;
	
	this.resetForce = function() {
		this.instantaneousForce.x = 0.0;
		this.instantaneousForce.y = 0.0;
		this.instantaneousForce.z = 0.0;
	}
	
	this.appendForce = function(forceToAppend) {
		this.instantaneousForce.x += forceToAppend.x;
		this.instantaneousForce.y += forceToAppend.y;
		this.instantaneousForce.z += forceToAppend.z;
	}
}

function Vector() {
	this.x = 0.0;
	this.y = 0.0;
	this.z = 0.0;
	
	this.magnitude = function() {
		return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z);
	}
	
	this.add = function(toVector) {
		this.x += toVector.x;
		this.y += toVector.y;
		this.z += toVector.z;
		return this;
	}
	
	this.sub = function(toVector) {
		this.x -= toVector.x;
		this.y -= toVector.y;
		this.z -= toVector.z;
		return this;
	}
}

function Vector2D() {
	this.x = 0.0;
	this.y = 0.0;
	
	this.magnitude = function() {
		return Math.sqrt(this.x*this.x+this.y*this.y);
	}
	
	this.add = function(toVector) {
		this.x += toVector.x;
		this.y += toVector.y;
		return this;
	}
	
	this.sub = function(toVector) {
		this.x -= toVector.x;
		this.y -= toVector.y;
		return this;
	}
}

//Particle Array
var particles = [];
var particlesPositionsX = [];
var particlesPositionsY = [];
var particlesPositionsZ = [];
var particlesPositions = [];
var historyLength = 500;
var currentHistoryLength = 0;
var hasFilledHistory = false;
var nparticles = 100;

var mathAvgTiming = 0.0; //Performance measurements
var drawAvgTiming = 0.0;
var mathSumTiming = 0.0; //Performance measurements
var drawSumTiming = 0.0;
var averageCount = 0;

//Lets get direct access to the image data for the canvas to try and speed up the performance of the drawing
var imageData = c.getImageData(0, 0, canvasWidth, canvasHeight);
var data = imageData.data;

var maxDistance = 1;
var halfTsquared = simTimeStep*simTimeStep*0.5;
var m0 = 0;
var m1 = 0;
var m2 = 0;
var m3 = 0;
var m4 = 0;
var timeinSQRT = 0;
//Camera Depth
var d = 200;

//Simulation step
function step() {
	//funciton varibles
	var n0 = currentHistoryLength*nparticles;
	var boolMaxMinSet = false;
	
	m0 = performance.now();
	//Calculate positions
	for(i = 0; i < nparticles; i++) {
		//if(particles[i].dynamic) {
			//Record previous watched variables
			particlesPositionsX[n0+i] = particles[i].position.x;
			particlesPositionsY[n0+i] = particles[i].position.y;
			particlesPositionsZ[n0+i] = particles[i].position.z;
			
			var acceleration = new Vector();
			acceleration.x = particles[i].instantaneousForce.x/particles[i].mass;
			acceleration.y = particles[i].instantaneousForce.y/particles[i].mass;
			acceleration.z = particles[i].instantaneousForce.z/particles[i].mass;
			
			var travel = new Vector();
			travel.x = simTimeStep*particles[i].velocity.x+halfTsquared*acceleration.x;
			travel.y = simTimeStep*particles[i].velocity.y+halfTsquared*acceleration.y;
			travel.z = simTimeStep*particles[i].velocity.z+halfTsquared*acceleration.z;
			
			particles[i].position.x = particles[i].position.x + travel.x;
			particles[i].position.y = particles[i].position.y + travel.y;
			particles[i].position.z = particles[i].position.z + travel.z;
			particles[i].velocity.x = particles[i].velocity.x+acceleration.x*simTimeStep;
			particles[i].velocity.y = particles[i].velocity.y+acceleration.y*simTimeStep;
			particles[i].velocity.z = particles[i].velocity.z+acceleration.z*simTimeStep;
			
			//if(travel.x > maxDistance) maxDistance = travel.x;
			//if(travel.y > maxDistance) maxDistance = travel.y;
			
			//Track the max and mins of the extents of the particles for window simulation adjustments
			if(particles[i].position.x > tempMaxX) tempMaxX=particles[i].position.x;
			else if(particles[i].position.x < tempMinX) tempMinX=particles[i].position.x;
			if(particles[i].position.y > tempMaxY) tempMaxY = particles[i].position.y;
			else if(particles[i].position.y < tempMinY) tempMinY = particles[i].position.y;
		//}
	}
	
	currentHistoryLength++;
	//If the history log gets to the limit of the log, then reset (i.e. start replacing the oldest information
	if(currentHistoryLength>=historyLength) {
		currentHistoryLength=0;
		hasFilledHistory=true;
	}
	
	m1 = performance.now();
	
	//Re-calculate forces
	var particlesDistance = new Vector();
	var distance = 0;
	var mForce = 0;
	var uForce = new Vector();
	var uinvForce = new Vector();
	for (i = 0; i < nparticles; i++) {
		for (z = i+1; z < nparticles; z++) {
			particlesDistance.x = particles[i].position.x - particles[z].position.x;
			particlesDistance.y = particles[i].position.y - particles[z].position.y;
			particlesDistance.z = particles[i].position.z - particles[z].position.z;
			distance = Math.sqrt(particlesDistance.x*particlesDistance.x+particlesDistance.y*particlesDistance.y+particlesDistance.z*particlesDistance.z);
			mForce = (columbsConstant*particles[i].charge*particles[z].charge)/distance;
			uForce.x = particlesDistance.x*mForce;
			uForce.y = particlesDistance.y*mForce;
			uForce.z = particlesDistance.z*mForce;
			uinvForce.x = -uForce.x;
			uinvForce.y = -uForce.y;
			uinvForce.z = -uForce.z;
			particles[i].appendForce(uForce);
			particles[z].appendForce(uinvForce);
		}
	}
	
	m2 = performance.now();
}

function project(M) {
    // Distance between the camera and the plane
    var d = 200;
    var r = d / M.z;
    return new Vector2D(r * M.x, r * M.y);
}

function draw3DLine(x0, x1, y0, y1, z0, z1, red, green, blue, alpha) {
	if(z0<0 || z1<0) return;
	
	let dx = canvas.width / 2;
	let dy = canvas.height / 2;
	
	x0 = x0-dx;
	y0 = y0-dy;
	x1 = x1-dx;
	y1 = y1-dy;
	
    var r = d / z0;
    x0 = r*x0;
    y0 = r*y0;
    r = d / z1;
    x1 = r*x1;
    y1 = r*y1;
	
	x0 = x0+dx;
	y0 = y0+dy;
	x1 = x1+dx;
	y1 = y1+dy;
	
	drawLine(x0, x1, y0, y1, red, green, blue, alpha);
}

function drawLine(x0, x1, y0, y1, red, green, blue, alpha) {
	let frompixx = Math.round(x0);
	let frompixy = Math.round(y0);
	let topixx = Math.round(x1);
	let topixy = Math.round(y1);
	let dx = Math.abs(topixx - frompixx);
	let dy = Math.abs(topixy - frompixy);
	let sx = (frompixx < topixx) ? 1: -1;
	let sy = (frompixy < topixy) ? 1: -1;
	var err = dx-dy;
	
	if(frompixx > canvas.width || frompixx < 0) { return;}
	if(topixx > canvas.width || topixx < 0) { return;}
	if(frompixy > canvas.height || frompixy < 0) { return;}
	if(topixy > canvas.height || topixy < 0) { return;}
	
	while(true) {
		let index = frompixy*canvas.width*4+frompixx*4;
		data[index] = red;
		data[index+1] = green;
		data[index+2] = blue;
		data[index+3] = alpha;
		
		if ((frompixx==topixx) && (frompixy==topixy)) break;
		var e2 = 2*err;
		if (e2 >-dy){ err -= dy; frompixx += sx; }
		if (e2 < dx){ err += dx; frompixy += sy; }
	}
}

var mathTiming = 0.0; //Performance measurements
var drawTiming = 0.0;
var t1 = 0.0;
var t0 = 0.0;
//Start simulation
function animate() {
	if(simTotalTime <= simStopTime) {
		requestAnimationFrame(animate); // This is the loop to call the function again to render the canvas
	}
	
	now = Date.now();
	delta = now - then;
	
	t0 = performance.now();	//Lets measure the time to undertake the full math
		
	//Run the sim
	if(simTotalTime <= simStopTime) {step();simTotalTime += simTimeStep;} //Progress simulation one step
	
	t1 = performance.now();	//Lets measure the time to undertake the full math
	mathTiming += t1-t0;
	
	if(delta > interval) {
		
		//Draw the scene
		drawScene();
		
		//Setup for next 
		then = now - (delta % interval);
	}
}

function drawScene() {
	c.clearRect(0, 0, canvas.width, canvas.height); //Clear the screen
	imageData = c.getImageData(0, 0, canvas.width, canvas.height);
	data = imageData.data;

	//Determine the new viewport extents
	maxParticleY = tempMaxY;
	minParticleY = tempMinY;
	maxParticleX = tempMaxX;
	minParticleX = tempMinX;
	//d = d-0.1;
	
	/* Auto camera panning and zooming
	//TODO: Currently broken with 3d soft engine, also need to determine smooth transitions
	viewportHeight = (maxParticleY - minParticleY);
	viewportHeightBuffer = viewportHeight*viewportBufferPercent/100;
	viewportHeight += viewportHeightBuffer*2;
	viewportWidth = (maxParticleX - minParticleX);
	viewportWidthBuffer = viewportWidth*viewportBufferPercent/100;
	viewportWidth += viewportWidthBuffer*2;
	
	viewportYZero = minParticleY-viewportHeightBuffer;
	viewportXZero = minParticleX-viewportWidthBuffer;*/
	
	scaleHeight = (canvas.height / viewportHeight);
	scaleWidth = (canvas.width / viewportWidth);

	var greyIndex = 0;
	var stepSize = 16 / historyLength;
	var strokeColor = 0;
	for(h=currentHistoryLength-1;h>0;h--)
	{
		for(n=0;n<nparticles;n++) {
			let fx = (particlesPositionsX[h*nparticles+n]-viewportXZero)*scaleWidth;
			let fy = (particlesPositionsY[h*nparticles+n]-viewportYZero)*scaleHeight;
			let tx = (particlesPositionsX[(h-1)*nparticles+n]-viewportXZero)*scaleWidth;
			let ty = (particlesPositionsY[(h-1)*nparticles+n]-viewportYZero)*scaleHeight;
			let fz = (particlesPositionsZ[h*nparticles+n])*scaleWidth;
			let tz = (particlesPositionsZ[(h-1)*nparticles+n])*scaleWidth;
			
			var strokeColor = Math.round((255*(historyLength-greyIndex)) / historyLength );
			var redColor = 0;
			var blueColor = 0;
			if(particles[n].charge < 0) blueColor = 255;
			else redColor = 255;
			var alphaColor = 255;//strokeColor;
			
			//var m = -(tx-fx)/(ty-fy);
			//var particleStreamSize = 2;
			
			draw3DLine(fx, tx, fy+100, ty+100, fz, tz, redColor, 0, blueColor, alphaColor);
			draw3DLine(fx, tx, fy-100, ty-100, fz, tz, redColor, 0, blueColor, alphaColor);
			draw3DLine(fx, fx, fy+100, fy-100, fz, fz, redColor, 0, blueColor, alphaColor);
			draw3DLine(tx, tx, ty+100, ty-100, tz, tz, redColor, 0, blueColor, alphaColor);
			
			//drawLine(fx, tx, fy, ty, redColor, 0, blueColor);
		}
		greyIndex++;
	}
    
	
	if(hasFilledHistory && currentHistoryLength!=historyLength) {
		
		if(currentHistoryLength!=0)
		{
			for(n=0;n<nparticles;n++) {

					let fx = (particlesPositionsX[n]-viewportXZero)*scaleWidth;
					let fy = (particlesPositionsY[n]-viewportYZero)*scaleHeight;
					let tx = (particlesPositionsX[(historyLength-1)*nparticles+n]-viewportXZero)*scaleWidth;
					let ty = (particlesPositionsY[(historyLength-1)*nparticles+n]-viewportYZero)*scaleHeight;
					let fz = (particlesPositionsZ[n])*scaleWidth;
					let tz = (particlesPositionsZ[(historyLength-1)*nparticles+n])*scaleWidth;
					
					var strokeColor = Math.round((255*(historyLength-greyIndex)) / historyLength );
					var redColor = 0;
					var blueColor = 0;
					if(particles[n].charge < 0) blueColor = 255;
					else redColor = 255;
					var alphaColor = 255;//strokeColor;
					
					//draw3DLine(fx, tx, fy, ty, fz, tz, redColor, 0, blueColor);
					
					draw3DLine(fx, tx, fy+100, ty+100, fz, tz, redColor, 0, blueColor, alphaColor);
					draw3DLine(fx, tx, fy-100, ty-100, fz, tz, redColor, 0, blueColor, alphaColor);
					draw3DLine(fx, fx, fy+100, fy-100, fz, fz, redColor, 0, blueColor, alphaColor);
					draw3DLine(tx, tx, ty+100, ty-100, tz, tz, redColor, 0, blueColor, alphaColor);
			
					//drawLine(fx, tx, fy, ty, redColor, 0, blueColor);
			}
			greyIndex++;
		}
		for(h=historyLength-1;h>currentHistoryLength;h--)
		{
			for(n=0;n<nparticles;n++) {
				let fx = (particlesPositionsX[h*nparticles+n]-viewportXZero)*scaleWidth;
				let fy = (particlesPositionsY[h*nparticles+n]-viewportYZero)*scaleHeight;
				let tx = (particlesPositionsX[(h-1)*nparticles+n]-viewportXZero)*scaleWidth;
				let ty = (particlesPositionsY[(h-1)*nparticles+n]-viewportYZero)*scaleHeight;
				let fz = (particlesPositionsZ[h*nparticles+n])*scaleWidth;
				let tz = (particlesPositionsZ[(h-1)*nparticles+n])*scaleWidth;
				
				var strokeColor = Math.round((255*(historyLength-greyIndex)) / historyLength );
				var redColor = 0;
				var blueColor = 0;
				if(particles[n].charge < 0) blueColor = 255;
				else redColor = 255;
				var alphaColor = 255;//strokeColor;
				
				//draw3DLine(fx, tx, fy, ty, fz, tz, redColor, 0, blueColor);
				
				draw3DLine(fx, tx, fy+100, ty+100, fz, tz, redColor, 0, blueColor, alphaColor);
				draw3DLine(fx, tx, fy-100, ty-100, fz, tz, redColor, 0, blueColor, alphaColor);
				draw3DLine(fx, fx, fy+100, fy-100, fz, fz, redColor, 0, blueColor, alphaColor);
				draw3DLine(tx, tx, ty+100, ty-100, tz, tz, redColor, 0, blueColor, alphaColor);
			
				//drawLine(fx, tx, fy, ty, redColor, 0, blueColor);
			}
			greyIndex++;
		}
	}
	
	/*
	var sqx1 = (canvas.width / 2)-50;
	var sqy1 = (canvas.height / 2)-50;
	var sqz1 = 500;
	var sqwidth = 100;
	var sqheight = 100;
	var sqdepth = 100;
	
	draw3DLine(sqx1, sqx1+sqwidth, sqy1, sqy1, sqz1, sqz1, 0, 0, 0, 255);
	draw3DLine(sqx1+sqwidth, sqx1+sqwidth, sqy1, sqy1+sqheight, sqz1, sqz1, 0, 0, 0, 255);
	draw3DLine(sqx1+sqwidth, sqx1, sqy1+sqheight, sqy1+sqheight, sqz1, sqz1, 0, 0, 0, 255);
	draw3DLine(sqx1, sqx1, sqy1+sqheight, sqy1, sqz1, sqz1, 0, 0, 0, 255);
	
	draw3DLine(sqx1, sqx1+sqwidth, sqy1, sqy1, sqz1+sqdepth, sqz1+sqdepth, 0, 0, 0, 255);
	draw3DLine(sqx1+sqwidth, sqx1+sqwidth, sqy1, sqy1+sqheight, sqz1+sqdepth, sqz1+sqdepth, 0, 0, 0, 255);
	draw3DLine(sqx1+sqwidth, sqx1, sqy1+sqheight, sqy1+sqheight, sqz1+sqdepth, sqz1+sqdepth, 0, 0, 0, 255);
	draw3DLine(sqx1, sqx1, sqy1+sqheight, sqy1, sqz1+sqdepth, sqz1+sqdepth, 0, 0, 0, 255);
	
	draw3DLine(sqx1, sqx1, sqy1, sqy1, sqz1, sqz1+sqdepth, 0, 0, 0, 255);
	draw3DLine(sqx1+sqwidth, sqx1+sqwidth, sqy1, sqy1, sqz1, sqz1+sqdepth, 0, 0, 0, 255);
	draw3DLine(sqx1, sqx1, sqy1+sqheight, sqy1+sqheight, sqz1, sqz1+sqdepth, 0, 0, 0, 255);
	draw3DLine(sqx1+sqwidth, sqx1+sqwidth, sqy1+sqheight, sqy1+sqheight, sqz1, sqz1+sqdepth, 0, 0, 0, 255);
	*/
	
	var t2 = performance.now();	//Lets measure the time to undertake the draw
	drawTiming += t2-t1;
	
	mathSumTiming += mathTiming;
	averageCount++;
	mathAvgTiming = Math.round(mathSumTiming/averageCount);
	
	drawSumTiming += drawTiming;
	drawAvgTiming = Math.round(drawSumTiming/averageCount);
	
	var posMath = Math.round(m1-m0);
	var fMath = Math.round(m2-m1);
	
	//Debugging stuff
	c.putImageData(imageData,0,0);
	
	c.font = this.font;
	c.fillStyle = 'white';
	c.fillText('Math:' + mathAvgTiming + "ms, Pos/F:" + posMath + "/" + fMath + " Draw:" + drawAvgTiming +"ms Canvas:",10,canvas.height-10);
	timeinSQRT = 0;
}

function setupParticles() {
	//Setup Simulated Particle Array
	for(i=0;i<nparticles;i++) {
		particles[i] = new Particle();
		
		if( Math.random() > 0.5) { //Create an electron
			particles[i].charge = -simChargeUnit;
		}
		else {
			particles[i].charge = simChargeUnit;
		}
		particles[i].dynamic = true;
		particles[i].mass = 0.00001;
		particles[i].position.x = Math.random()*canvas.width;
		particles[i].position.y = Math.random()*canvas.height;
		particles[i].position.z = Math.random()*canvasDepth+canvasDepthMin;
	}
}

function resizeCanvas() {
	//Set the canvas to fill the screen
	canvasWidth = window.innerWidth;
	canvasHeight = window.innerHeight*0.75;
	
	var pixelRatio = window.devicePixelRatio;
	canvas.width = canvasWidth*pixelRatio;
	canvas.height = canvasHeight*pixelRatio;
	viewportWidth = canvas.width;
	viewportHeight = canvas.height;

	canvas.style.width = canvasWidth + "px";
	canvas.style.height = canvasHeight + "px";
	
	//Get the canvas Context obejct, this is the object we call the methods to draw onto the canvas
	//canvasWidth = canvas.width;
	//canvasHeight = canvas.height;
	if(simTotalTime > simStopTime) animate();
}

function startSimulation() {
	resizeCanvas();
	setupParticles();
	animate();
}

function init(){
	window.addEventListener('resize', resizeCanvas, false);
	window.addEventListener('load', startSimulation, false);
}

//Get things going
init();