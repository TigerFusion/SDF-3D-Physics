"use strict";

// ****************** This code is from me, Jonathan ******************

const RESOLUTION = 1; // 0.5 is half the resolution
const MAX_POINTS = 4;

const SHAPE_NULL = 0;
const SHAPE_SPHERE = 1;
const SHAPE_BOX = 2;
const SHAPE_CAPSULE = 3;

const NULL_AND_NULL = 0;
const SPHERE_AND_SPHERE = 4;
const SPHERE_AND_BOX = 5, BOX_AND_SPHERE = 5;
const SPHERE_AND_CAPSULE = 6, CAPSULE_AND_SPHERE = 6;
const BOX_AND_BOX = 7;
const CAPSULE_AND_CAPSULE = 8;
const CAPSULE_AND_BOX = 9, BOX_AND_CAPSULE = 9;

function init()
{
	// This makes the body the full size of the window
	document.body.style.margin = "0px";
	document.body.style.padding = "0px";
	document.body.style.width = "100%";
	document.body.style.height = "100%";
	document.body.style.overflow = "hidden";
	
	// This resizes the webgl view to the full size of the window view
	let canvas = document.createElement("canvas");
	canvas.style.width = "100%";
	canvas.style.height = "100%";
	
	document.body.appendChild(canvas);
	
	let fpsNode = document.createElement("div");
	fpsNode.style.backgroundColor = "rgba(50%, 50%, 50%, 0.5)";
	fpsNode.style.margin = "0px 5px";
	fpsNode.style.padding = "6px 5px";
	fpsNode.style.borderRadius = "5px";
	fpsNode.style.width = "50px";
	fpsNode.style.fontSize = "15px";
	fpsNode.style.textAlign = "center";
	fpsNode.style.color = "white";
	fpsNode.style.top = "15px";
	fpsNode.style.left = "10px";
	fpsNode.style.position = "fixed";
	fpsNode.style.display = "none";
	fpsNode.style.zIndex = 1;
	fpsNode.style.display = "block";
	fpsNode.innerHTML = "00FPS";
	
	document.body.appendChild(fpsNode);
	
	let cpuNode = document.createElement("div");
	cpuNode.style.backgroundColor = "rgba(50%, 50%, 50%, 0.5)";
	cpuNode.style.margin = "0px 5px";
	cpuNode.style.padding = "6px 5px";
	cpuNode.style.borderRadius = "5px";
	cpuNode.style.width = "60px";
	cpuNode.style.fontSize = "15px";
	cpuNode.style.textAlign = "center";
	cpuNode.style.color = "white";
	cpuNode.style.top = "15px";
	cpuNode.style.left = "80px";
	cpuNode.style.position = "fixed";
	cpuNode.style.display = "none";
	cpuNode.style.zIndex = 1;
	cpuNode.style.display = "block";
	cpuNode.innerHTML = "000MS";
	
	document.body.appendChild(cpuNode);

	let project = new Project(cpuNode, fpsNode, canvas);
    project.createEventListeners(project.gl);
	project.update();
}

class Project
{
    constructor(cpuNode, fpsNode, canvas)
    {
        this.canvas = canvas;
        let gl = getWebGLContext(this.canvas);

        if (!gl)
        {
            console.log("Failed to get the rendering context for WebGL");
            return;
        }

        this.shaderProgram = initShaderProgram(gl, GLSLVertexShader, GLSLFragmentShader);
        
        if (!this.shaderProgram)
        {
            console.log("Failed to intialize shaders.");
            return;
        }

        this.physics = new Physics();
        this.cpuNode = cpuNode;
        this.fpsNode = fpsNode;
        this.gl = gl;
        this.totalTime = 0;

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        // Uniforms
        this.shaderProgram.u_resolutionLoc = gl.getUniformLocation(this.shaderProgram, "iResolution");
        this.shaderProgram.u_mouseLoc = gl.getUniformLocation(this.shaderProgram, "iMouse");
        this.shaderProgram.u_timeLoc = gl.getUniformLocation(this.shaderProgram, "iTime");
        this.shaderProgram.u_timeDeltaLoc = gl.getUniformLocation(this.shaderProgram, "iTimeDelta");
        
        // Keyboard Events
        this.shaderProgram.u_physicsContactsLoc = [];

        for (let i = 0; i < MAX_POINTS; i++)
        {
            this.shaderProgram.u_physicsContactsLoc.push(gl.getUniformLocation(this.shaderProgram, "u_physicsContacts[" + i + "]"));
        }

        this.shaderProgram.u_outerPositionLoc = gl.getUniformLocation(this.shaderProgram, "u_outerPosition");
        this.shaderProgram.u_outerAngleLoc = gl.getUniformLocation(this.shaderProgram, "u_outerAngle");
        this.shaderProgram.u_outerHalfExtentsLoc = gl.getUniformLocation(this.shaderProgram, "u_outerHalfExtents");
        this.shaderProgram.u_outerRadiusLoc = gl.getUniformLocation(this.shaderProgram, "u_outerRadius");

        this.shaderProgram.u_centerPositionLoc = gl.getUniformLocation(this.shaderProgram, "u_centerPosition");
        this.shaderProgram.u_centerAngleLoc = gl.getUniformLocation(this.shaderProgram, "u_centerAngle");
        this.shaderProgram.u_centerHalfExtentsLoc = gl.getUniformLocation(this.shaderProgram, "u_centerHalfExtents");
        this.shaderProgram.u_centerRadiusLoc = gl.getUniformLocation(this.shaderProgram, "u_centerRadius");
    
        this.shaderProgram.u_minkowskiHalfExtentsLoc = gl.getUniformLocation(this.shaderProgram, "u_minkowskiHalfExtents");
        this.shaderProgram.u_minkowskiRadiusLoc = gl.getUniformLocation(this.shaderProgram, "u_minkowskiRadius");

        // Attributes
        this.shaderProgram.a_verticesLoc = gl.getAttribLocation(this.shaderProgram, "a_vertices");
            
        gl.useProgram(this.shaderProgram);
        
        this.verticesArray =
        [
            1.0, 1.0,
            -1.0, 1.0,
            -1.0,-1.0,
            1.0,-1.0
        ];

        this.indicesArray =
        [
            0, 1, 2, 0, 2, 3
        ];
        
        this.vertexBuffer = gl.createBuffer();
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.verticesArray), gl.STATIC_DRAW);
        
        this.indexBuffer = gl.createBuffer();
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indicesArray), gl.STATIC_DRAW);

        // Create the VAO
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        gl.enableVertexAttribArray(this.shaderProgram.a_verticesLoc);
        gl.vertexAttribPointer(this.shaderProgram.a_verticesLoc, 2, gl.FLOAT, false, 0, 0);
        
        // Clear VAO
        gl.bindVertexArray(null);

        this.canvas.width = window.innerWidth * RESOLUTION;
        this.canvas.height = window.innerHeight * RESOLUTION;
        
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    createEventListeners()
    {
        let gl = this.gl;
        let mouseDown = false;
        let dragAngleX = 0;
        let dragAngleY = 0;

        document.addEventListener("keydown", (event) =>
        {
            // 0 is x and 1 is y
            switch (event.key)
            {
                case "ArrowUp":
                    this.outerShape.velocity[1] = 1.0;
                break;
                
                case "ArrowDown":
                    this.outerShape.velocity[1] =-1.0;
                break;

                case "ArrowLeft":
                    this.outerShape.angularVelocity[2] = 80.0;
                break;
                
                case "ArrowRight":
                    this.outerShape.angularVelocity[2] =-80.0;
                break;
                
                case "q":
                    this.centerShape.angularVelocity[2] = 80.0;
                break;
                
                case "e":
                    this.centerShape.angularVelocity[2] =-80.0;
                break;
            }
        });

        document.addEventListener("keyup", (event) =>
        {		
            // 0 is x and 1 is y
            switch (event.key)
            {
                case "ArrowUp":
                case "ArrowDown":
                    this.outerShape.velocity[1] = 0;
                break;

                case "ArrowLeft":
                case "ArrowRight":
                    this.outerShape.angularVelocity[2] = 0;
                break;

                case "q":
                case "e":
                    this.centerShape.angularVelocity[2] = 0;
                break;

                // "r" resets the scene
                case "r":
                    this.createShapes(this.shapeCollision);
                break;

                // Spacebar switches the shapes in the scene
                case " ":
                    if (this.shapeCollision === CAPSULE_AND_BOX)
                    {
                        this.createShapes(SPHERE_AND_SPHERE);
                    }
                    else if (this.shapeCollision === SPHERE_AND_SPHERE)
                    {
                        this.createShapes(SPHERE_AND_BOX);
                    }
                    else if (this.shapeCollision === SPHERE_AND_BOX)
                    {
                        this.createShapes(SPHERE_AND_CAPSULE);
                    }
                    else if (this.shapeCollision === SPHERE_AND_CAPSULE)
                    {
                        this.createShapes(BOX_AND_BOX);
                    }
                    else if (this.shapeCollision === BOX_AND_BOX)
                    {
                        this.createShapes(CAPSULE_AND_CAPSULE);
                    }
                    else if (this.shapeCollision === CAPSULE_AND_CAPSULE)
                    {
                        this.createShapes(CAPSULE_AND_BOX);
                    }
                break;
            }
        });

        // iMouse pixel coords. xy: move position, zw: click position
        document.addEventListener("mousedown", (event) =>
        {
            this.offsetX = event.clientX;
            this.offsetY = event.clientY;

            mouseDown = true;
        });
        
        document.addEventListener("mousemove", (event) =>
        {		
            if (mouseDown === true)
            {
                // The values are flipped because of the rotation axises
                dragAngleX += (event.clientY - this.offsetY);
                dragAngleY += (event.clientX - this.offsetX);
                            
                gl.uniform2f(this.shaderProgram.u_mouseLoc, dragAngleX, dragAngleY);

                // These are not flipped because they are used with the "event.client"
                this.offsetX = event.clientX;
                this.offsetY = event.clientY;
            }
        });
        
        document.addEventListener("mouseup", (event) =>
        {		
            if (mouseDown === true)
            {
                this.offsetX = event.clientX;
                this.offsetY = event.clientY;

                mouseDown = false;
            }
        });

        window.addEventListener("resize", (event) =>
        {
            // event.preventDefault(); prevents a system beep from older browsers
            this.canvas.width = window.innerWidth * RESOLUTION;
            this.canvas.height = window.innerHeight * RESOLUTION;
            
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        });
    }

    createShapes(shapeCollision)
    {
        // SHAPE_SPHERE | SHAPE_BOX | SHAPE_CAPSULE
        let outerShape = SHAPE_NULL; // Outer Shape that the keyboard moves
        let centerShape = SHAPE_NULL; // Shape in the center
        this.shapeCollision = shapeCollision;

        if (shapeCollision === SPHERE_AND_SPHERE)
        {
            outerShape = SHAPE_SPHERE;
            centerShape = SHAPE_SPHERE; 
        }
        else if (shapeCollision === SPHERE_AND_BOX)
        {
            outerShape = SHAPE_SPHERE;
            centerShape = SHAPE_BOX; 
        }
        else if (shapeCollision === SPHERE_AND_CAPSULE)
        {
            outerShape = SHAPE_SPHERE;
            centerShape = SHAPE_CAPSULE; 
        }
        else if (shapeCollision === BOX_AND_BOX)
        {
            outerShape = SHAPE_BOX;
            centerShape = SHAPE_BOX;
        }
        else if (shapeCollision === CAPSULE_AND_CAPSULE)
        {
            outerShape = SHAPE_CAPSULE;
            centerShape = SHAPE_CAPSULE; 
        }
        else if (shapeCollision === CAPSULE_AND_BOX)
        {
            outerShape = SHAPE_CAPSULE;
            centerShape = SHAPE_BOX;
        }

        this.minkowskiShape = 
        {
            position:vec3.init(),
            angle:vec3.init(), // in degrees
            halfExtents:vec3.init(),
            radius:0
        };

        // ***** Shape Angles in Degrees *****
    // First Shapes
        if (outerShape === SHAPE_SPHERE)
        {
            this.outerShape =
            {
                shapeType:outerShape,
                position:vec3.init(-2,0,0),
                angle:vec3.init(), // in degrees
                velocity:vec3.init(),
                angularVelocity:vec3.init(),
                halfExtents:vec3.init(),
                radius:0.5
            };
        }
        else if (outerShape === SHAPE_BOX)
        {
            this.outerShape = 
            {
                shapeType:outerShape,
                position:vec3.init(-2,0,0),
                angle:vec3.init(), // in degrees
                velocity:vec3.init(),
                angularVelocity:vec3.init(),
                halfExtents:vec3.init(0.5, 1, 0.5),
                radius:0
            };
        }
        else if (outerShape === SHAPE_CAPSULE)
        {
            this.outerShape = 
            {
                shapeType:outerShape,
                position:vec3.init(-2,0,0),
                angle:vec3.init(), // in degrees
                velocity:vec3.init(),
                angularVelocity:vec3.init(),
                halfExtents:vec3.init(0, 0.5, 0),
                radius:0.5
            };
        }

    // Second Shapes
        if (centerShape === SHAPE_SPHERE)
        {
            this.centerShape =
            {
                shapeType:centerShape,
                position:vec3.init(0,0,0),
                angle:vec3.init(), // in degrees
                velocity:vec3.init(),
                angularVelocity:vec3.init(),
                halfExtents:vec3.init(),
                radius:0.7
            };
        }
        else if (centerShape === SHAPE_BOX)
        {
            this.centerShape =
            {
                shapeType:centerShape,
                position:vec3.init(),
                angle:vec3.init(45,0,90), // in degrees
                velocity:vec3.init(),
                angularVelocity:vec3.init(),
                halfExtents:vec3.init(0.7, 1, 0.5),
                radius:0
            };
        }
        else if (centerShape === SHAPE_CAPSULE)
        {
            this.centerShape = 
            {
                shapeType:centerShape,
                position:vec3.init(),
                angle:vec3.init(45, 0, 40), // in degrees
                velocity:vec3.init(),
                angularVelocity:vec3.init(),
                halfExtents:vec3.init(0, 0.5, 0),
                radius:0.7
            };
        }
    }

    update()
    {
        let gl = this.gl;
        this.time = 0;
        this.timeStep = 0;

        // Frames per second
        let frameLoop =
        {
            frameCount:0,
            timeElapsed:0,
            now:0,
            timeStep:0,
            // In milliseconds
            lastTime:Date.now(),
            averageTime:0,
            oldTime:0
        }

        this.createShapes(SPHERE_AND_SPHERE);

        let updateAnimation = () =>
        {
            frameLoop.now = Date.now();
            // 1000 converts it to seconds
            frameLoop.timeStep = (frameLoop.now - frameLoop.lastTime) / 1000;
            frameLoop.lastTime = frameLoop.now;
            frameLoop.frameCount++;
            frameLoop.timeElapsed += frameLoop.timeStep;

            if (frameLoop.timeElapsed >= 1)
            {
                this.fpsNode.innerHTML = Math.round(frameLoop.frameCount / frameLoop.timeElapsed) + "FPS";
                frameLoop.frameCount = 0;
                frameLoop.timeElapsed = 0;
            }
            
            if (frameLoop.averageTime >= 10)
            {
                this.cpuNode.innerHTML = Math.round((Date.now() - frameLoop.oldTime) / frameLoop.averageTime) + "MS";
                frameLoop.averageTime = 0;
            }
            else if (frameLoop.averageTime === 0)
            {
                frameLoop.oldTime = Date.now();
                frameLoop.averageTime++;
            }
            else
            {
                frameLoop.averageTime++;
            }

            gl.uniform2f(this.shaderProgram.u_resolutionLoc, this.canvas.width, this.canvas.height);

            this.time += frameLoop.timeStep;
            this.timeStep = frameLoop.timeStep;

            gl.uniform1f(this.shaderProgram.u_timeLoc, this.time);
            gl.uniform1f(this.shaderProgram.u_timeDeltaLoc, this.timeStep);

            this.updatePhysics();

            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.bindVertexArray(this.vao);
            gl.drawElements(gl.TRIANGLES, this.indicesArray.length, gl.UNSIGNED_SHORT, 0);
            gl.bindVertexArray(null);
            
            window.requestAnimationFrame(updateAnimation);
        }

        updateAnimation();
    }

    updatePhysics()
    {
        let gl = this.gl;

        // outer = 0 and center = 1
        this.physics.updateCollision(this.outerShape, this.centerShape, this.timeStep);

        for (let i = 0; i < MAX_POINTS; i++)
        {
            let contact = this.physics.physicsContacts[i];

            if (contact === undefined)
            {
                contact = vec3.init();
            }

            gl.uniform3fv(this.shaderProgram.u_physicsContactsLoc[i], contact);
        }

        gl.uniform3fv(this.shaderProgram.u_outerPositionLoc, this.outerShape.position);
        gl.uniform3fv(this.shaderProgram.u_outerAngleLoc, this.outerShape.angle); // in degrees
        gl.uniform3fv(this.shaderProgram.u_outerHalfExtentsLoc, this.outerShape.halfExtents);
        gl.uniform1f(this.shaderProgram.u_outerRadiusLoc, this.outerShape.radius);

        gl.uniform3fv(this.shaderProgram.u_centerPositionLoc, this.centerShape.position);
        gl.uniform3fv(this.shaderProgram.u_centerAngleLoc, this.centerShape.angle); // in degrees
        gl.uniform3fv(this.shaderProgram.u_centerHalfExtentsLoc, this.centerShape.halfExtents);
        gl.uniform1f(this.shaderProgram.u_centerRadiusLoc, this.centerShape.radius);

        gl.uniform3fv(this.shaderProgram.u_minkowskiHalfExtentsLoc, this.physics.halfExtents);
        gl.uniform1f(this.shaderProgram.u_minkowskiRadiusLoc, this.physics.radius);
    }
}

class Physics
{
    constructor()
    {
        this.halfExtents = vec3.init();
        this.radius = 0;
        this.physicsContacts = [];
    }
    
    updateCollision(outerShape, centerShape, timeStep)
    {
        outerShape.angle = vec3.sumScaleVector(outerShape.angle, outerShape.angularVelocity, timeStep);
        let outerVelocity = vec3.transformMat3(mat3.euler(vec3.radFromDeg(outerShape.angle)), outerShape.velocity);
        outerShape.position = vec3.sumScaleVector(outerShape.position, outerVelocity, timeStep);

        centerShape.angle = vec3.sumScaleVector(centerShape.angle, centerShape.angularVelocity, timeStep);
        let centerVelocity = vec3.transformMat3(mat3.euler(vec3.radFromDeg(centerShape.angle)), centerShape.velocity);
        centerShape.position = vec3.sumScaleVector(centerShape.position, centerVelocity, timeStep);

        if (outerShape.shapeType === SHAPE_SPHERE && centerShape.shapeType === SHAPE_SPHERE)
        {
            // this = sphere1 = outer sphere
            // shape = sphere2 = center sphere
            this.updateSphereToSphere(outerShape, centerShape);
        }
        else if (outerShape.shapeType === SHAPE_SPHERE && centerShape.shapeType === SHAPE_BOX)
        {
            // this = sphere = outer sphere
            // shape = box = center box
            this.updateSphereToBox(outerShape, centerShape);
        }
        else if (outerShape.shapeType === SHAPE_SPHERE && centerShape.shapeType === SHAPE_CAPSULE)
        {
            // this = sphere = outer sphere
            // shape = capsule = center capsule
            this.updateSphereToCapsule(outerShape, centerShape);
        }
        else if (outerShape.shapeType === SHAPE_BOX && centerShape.shapeType === SHAPE_BOX)
        {
            // this = box1 = outer box1
            // shape = box2 = center box2
            this.updateBoxToBox(outerShape, centerShape);
        }
        else if (outerShape.shapeType === SHAPE_CAPSULE && centerShape.shapeType === SHAPE_CAPSULE)
        {
            // this = capsule1 = outer capsule
            // shape = capsule2 = center capsule
            this.updateCapsuleToCapsule(outerShape, centerShape);
        }
        else if (outerShape.shapeType === SHAPE_CAPSULE && centerShape.shapeType === SHAPE_BOX)
        {
            // this = box = outer box
            // shape = capsule = center capsule
            this.updateCapsuleToBox(outerShape, centerShape);
        }
    }

    updateSphereToSphere(outerSphere, centerSphere)
    {
        // this = sphere1 = outer sphere
        // shape = sphere2 = center sphere
        this.halfExtents = vec3.init();
        this.radius = outerSphere.radius + centerSphere.radius;

        let position = vec3.subtract(outerSphere.position, centerSphere.position);
        let sdg = sdgRoundBox(position, this.halfExtents, this.radius);
        let distance = sdg.distance, normal = sdg.normal;

        if (distance <= 0)
        {
            outerSphere.position = vec3.subtract(outerSphere.position, vec3.scale(normal, distance));
        }

        let centerContact = vec3.add(outerSphere.position, vec3.scale(normal,-distance - outerSphere.radius));
        let outerContact = vec3.add(outerSphere.position, vec3.scale(normal,-outerSphere.radius));
        let averageContact = vec3.scale(vec3.add(centerContact, outerContact), 0.5);

        // Yellow Minkowski Sum Contact
        this.physicsContacts[0] = outerSphere.position;
        // Magenta average center of contacts
        this.physicsContacts[1] = averageContact;
        // Red Contact Point for the centerSphere
        this.physicsContacts[2] = centerContact;
        // Blue Contact Point for the outerSphere
        this.physicsContacts[3] = outerContact;
    }

    updateSphereToBox(outerSphere, centerBox)
    {
        // this = sphere = outer sphere
        // shape = box = center box
        this.halfExtents = centerBox.halfExtents;
        this.radius = outerSphere.radius;

        let eulerMatrix = mat3.euler(vec3.radFromDeg(centerBox.angle));
        let transposeMatrix = mat3.transpose(eulerMatrix);

        // Outer Circle = sphere
        // Center Box = box
        let position = vec3.subtract(outerSphere.position, centerBox.position);
        let rotatePosition = vec3.transformMat3(transposeMatrix, position);
        let sdg = sdgRoundBox(rotatePosition, this.halfExtents, this.radius);
        let distance = sdg.distance, normal = sdg.normal;

        let rotateNormal = vec3.transformMat3(eulerMatrix, normal);

        if (distance <= 0)
        {
            outerSphere.position = vec3.subtract(outerSphere.position, vec3.scale(rotateNormal, distance));
        }

        let centerContact = vec3.add(outerSphere.position, vec3.scale(rotateNormal,-distance - outerSphere.radius));
        let outerContact = vec3.add(outerSphere.position, vec3.scale(rotateNormal,-outerSphere.radius));
        let averageContact = vec3.scale(vec3.add(centerContact, outerContact), 0.5);

        // Yellow Minkowski Sum Contact
        this.physicsContacts[0] = outerSphere.position;
        // Magenta average center of contacts
        this.physicsContacts[1] = averageContact;
        // Red Contact Point for the centerSphere
        this.physicsContacts[2] = centerContact;
        // Blue Contact Point for the outerSphere
        this.physicsContacts[3] = outerContact;
    }

    updateSphereToCapsule(outerSphere, centerCapsule)
    {
        // this = sphere = outer sphere
        // shape = capsule = center capsule
        this.halfExtents = centerCapsule.halfExtents;
        this.radius = outerSphere.radius + centerCapsule.radius;
        
        let eulerMatrix = mat3.euler(vec3.radFromDeg(centerCapsule.angle));
        let transposeMatrix = mat3.transpose(eulerMatrix);

        // Outer Circle = sphere
        // Center Capsule = capsule
        let position = vec3.subtract(outerSphere.position, centerCapsule.position);
        let rotatePosition = vec3.transformMat3(transposeMatrix, position);
        let sdg = sdgRoundBox(rotatePosition, this.halfExtents, this.radius);
        let distance = sdg.distance, normal = sdg.normal;
        let rotateNormal = vec3.transformMat3(eulerMatrix, normal);

        if (distance <= 0)
        {
            outerSphere.position = vec3.subtract(outerSphere.position, vec3.scale(rotateNormal, distance));
        }

        let centerContact = vec3.add(outerSphere.position, vec3.scale(rotateNormal,-distance - outerSphere.radius));
        let outerContact = vec3.add(outerSphere.position, vec3.scale(rotateNormal,-outerSphere.radius));
        let averageContact = vec3.scale(vec3.add(centerContact, outerContact), 0.5);

        // Yellow Minkowski Sum Contact
        this.physicsContacts[0] = outerSphere.position;
        // Magenta average center of contacts
        this.physicsContacts[1] = averageContact;
        // Red Contact Point for the centerSphere
        this.physicsContacts[2] = centerContact;
        // Blue Contact Point for the outerSphere
        this.physicsContacts[3] = outerContact;
    }

    updateBoxToBox(outerBox, centerBox)
    {
        // box1 = outer box
        // box2 = center box
        // Length
        let centerRadius = vec3.magnitude(centerBox.halfExtents);
        let outerRadius = vec3.magnitude(outerBox.halfExtents);

        let centerEulerMatrix = mat3.euler(vec3.radFromDeg(centerBox.angle));
        let centerTransposeMatrix = mat3.transpose(centerEulerMatrix);

        let outerEulerMatrix = mat3.euler(vec3.radFromDeg(outerBox.angle));
        let outerTransposeMatrix = mat3.transpose(outerEulerMatrix);

        // center box to outer sphere
        let position1 = vec3.subtract(outerBox.position, centerBox.position);
        let rotatePosition1 = vec3.transformMat3(centerTransposeMatrix, position1);
        let sdg1 = sdgRoundBox(rotatePosition1, centerBox.halfExtents, outerRadius);
        let distance1 = sdg1.distance, normal1 = sdg1.normal;
        let rotateNormal1 = vec3.transformMat3(centerEulerMatrix, normal1);
        let centerContact = vec3.add(outerBox.position, vec3.scale(rotateNormal1,-distance1 - outerRadius));

        // Outer box to center sphere
        let position2 = vec3.subtract(outerBox.position, centerBox.position);
        let rotatePosition2 = vec3.transformMat3(outerTransposeMatrix, position2);
        let sdg2 = sdgRoundBox(rotatePosition2, outerBox.halfExtents, centerRadius);
        let distance2 = sdg2.distance, normal2 = sdg2.normal;
        let rotateNormal2 = vec3.transformMat3(outerEulerMatrix, normal2);
        let outerContact = vec3.add(centerBox.position, vec3.scale(rotateNormal2, distance2 + centerRadius));
        
        // Red Contact Test the center box2 contact on outer box1
        let position3 = vec3.subtract(outerBox.position, centerContact);
        let rotatePosition3 = vec3.transformMat3(outerTransposeMatrix, position3);
        let sdg3 = sdgRoundBox(rotatePosition3, outerBox.halfExtents, 0);
        let distance3 = sdg3.distance, normal3 = sdg3.normal;
        let rotateNormal3 = vec3.transformMat3(outerEulerMatrix, normal3);

        // Blue Contact Test the outer box1 contact on center box2
        let position4 = vec3.subtract(outerContact, centerBox.position);
        let rotatePosition4 = vec3.transformMat3(centerTransposeMatrix, position4);
        let sdg4 = sdgRoundBox(rotatePosition4, centerBox.halfExtents, 0);
        let distance4 = sdg4.distance, normal4 = sdg4.normal;
        let rotateNormal4 = vec3.transformMat3(centerEulerMatrix, normal4);

        // Magenta average contact to see if it is closer than position3 or position4
        let averageContact = vec3.scale(vec3.add(outerContact, centerContact), 0.5);

        // Contact Test the average contact on outer box1
        let position5 = vec3.subtract(outerBox.position, averageContact);
        let rotatePosition5 = vec3.transformMat3(outerTransposeMatrix, position5);
        let sdg5 = sdgRoundBox(rotatePosition5, outerBox.halfExtents, 0);
        let distance5 = sdg5.distance, normal5 = sdg5.normal;
        let rotateNormal5 = vec3.transformMat3(outerEulerMatrix, normal5);

        // Contact Test the average contact on center box2
        let position6 = vec3.subtract(averageContact, centerBox.position);
        let rotatePosition6 = vec3.transformMat3(centerTransposeMatrix, position6);
        let sdg6 = sdgRoundBox(rotatePosition6, centerBox.halfExtents, 0);
        let distance6 = sdg6.distance, normal6 = sdg6.normal;
        let rotateNormal6 = vec3.transformMat3(centerEulerMatrix, normal6);

        // this = outer box = box1
        // shape = center box = box2
        let bestDistance = Infinity;
        let bestNormal = vec3.init();

        let distanceArray = [distance3, distance4, distance5, distance6];
        let normalArray = [rotateNormal3, rotateNormal4, rotateNormal5, rotateNormal6];
        
        // Find the lowest distance number and add the normal
        for (let i = 0; i < distanceArray.length; i++)
        {
            if (distanceArray[i] < bestDistance)
            {
                bestDistance = distanceArray[i];
                bestNormal = normalArray[i];
            }
        }

        if (bestDistance <= 0)
        {
            outerBox.position = vec3.subtract(outerBox.position, vec3.scale(bestNormal, bestDistance));
        }

        this.halfExtents = centerBox.halfExtents;
        // The radius/distance from the outer box to its contact
        this.radius = vec3.dotProduct(bestNormal, vec3.subtract(outerBox.position, outerContact));

        // Yellow Minkowski Sum Contact
        this.physicsContacts[0] = outerBox.position;
        // Magenta average center of contacts
        this.physicsContacts[1] = averageContact;
        // Red Contact Point for the center Box
        this.physicsContacts[2] = centerContact;
        // Blue Contact Point for the outer Box
        this.physicsContacts[3] = outerContact;
    }

    updateCapsuleToCapsule(outerCapsule, centerCapsule)
    {
        // this = capsule1 = outer capsule
        // shape = capsule2 = center capsule

        // Length of the line segment of the capsules
        let centerRadius = centerCapsule.halfExtents[1] + centerCapsule.radius;
        let outerRadius = outerCapsule.halfExtents[1] + outerCapsule.radius;

        let centerEulerMatrix = mat3.euler(vec3.radFromDeg(centerCapsule.angle));
        let centerTransposeMatrix = mat3.transpose(centerEulerMatrix);

        let outerEulerMatrix = mat3.euler(vec3.radFromDeg(outerCapsule.angle));
        let outerTransposeMatrix = mat3.transpose(outerEulerMatrix);

        // Center capsule to sphere
        let position1 = vec3.subtract(outerCapsule.position, centerCapsule.position);
        let rotatePosition1 = vec3.transformMat3(centerTransposeMatrix, position1);
        let sdg1 = sdgRoundBox(rotatePosition1, centerCapsule.halfExtents, centerCapsule.radius + outerRadius);
        let distance1 = sdg1.distance, normal1 = sdg1.normal;
        let rotateNormal1 = vec3.transformMat3(centerEulerMatrix, normal1);
        let centerContact = vec3.add(outerCapsule.position, vec3.scale(rotateNormal1,-distance1 - outerRadius));

        // Outer capsule to sphere
        let position2 = vec3.subtract(outerCapsule.position, centerCapsule.position);
        let rotatePosition2 = vec3.transformMat3(outerTransposeMatrix, position2);
        let sdg2 = sdgRoundBox(rotatePosition2, outerCapsule.halfExtents, outerCapsule.radius + centerRadius);
        let distance2 = sdg2.distance, normal2 = sdg2.normal;
        let rotateNormal2 = vec3.transformMat3(outerEulerMatrix, normal2);
        let outerContact = vec3.add(centerCapsule.position, vec3.scale(rotateNormal2, distance2 + centerRadius));

        // Red Contact on center capsule2
        let position3 = vec3.scale(rotateNormal1, distance1 + outerRadius);
        let rotatePosition3 = vec3.transformMat3(outerTransposeMatrix, position3);
        let sdg3 = sdgRoundBox(rotatePosition3, outerCapsule.halfExtents, outerCapsule.radius);
        let distance3 = sdg3.distance, normal3 = sdg3.normal;
        let rotateNormal3 = vec3.transformMat3(outerEulerMatrix, normal3);

        // Blue Contact on outer capsule1
        let position4 = vec3.scale(rotateNormal2, distance2 + centerRadius);
        let rotatePosition4 = vec3.transformMat3(centerTransposeMatrix, position4);
        let sdg4 = sdgRoundBox(rotatePosition4, centerCapsule.halfExtents, centerCapsule.radius);
        let distance4 = sdg4.distance, normal4 = sdg4.normal;
        let rotateNormal4 = vec3.transformMat3(centerEulerMatrix, normal4);

        // Magenta average contact to see if it is closer than position3 or position4
        let averageContact = vec3.scale(vec3.add(outerContact, centerContact), 0.5);

        // this = capsule1 = outer capsule
        // shape = capsule2 = center capsule
        let bestDistance = Infinity;
        let bestNormal = vec3.init();

        // Find the lowest distance number and add the normal
        if (distance3 < distance4)
        {
            bestDistance = distance3;
            bestNormal = rotateNormal3;
        }
        else
        {
            bestDistance = distance4;
            bestNormal = rotateNormal4;
        }

        if (bestDistance <= 0)
        {
            outerCapsule.position = vec3.subtract(outerCapsule.position, vec3.scale(bestNormal, bestDistance));
        }

        this.halfExtents = centerCapsule.halfExtents;
        // The radius/distance from the outer box to its contact
        this.radius = vec3.dotProduct(bestNormal, vec3.subtract(outerCapsule.position, outerContact)) + centerCapsule.radius;

        // Yellow Minkowski Sum Contact
        this.physicsContacts[0] = outerCapsule.position;
        // Magenta average center of contacts
        this.physicsContacts[1] = averageContact;
        // Red Contact Point for the center Capsule
        this.physicsContacts[2] = centerContact;
        // Blue Contact Point for the outer Capsule
        this.physicsContacts[3] = outerContact;
    }

    updateCapsuleToBox(outerCapsule, centerBox)
    {
        // shape = outer capsule2 to sphere
        // this = center box1 to sphere

        // Length
        let centerRadius = vec3.magnitude(centerBox.halfExtents);
        let outerRadius = outerCapsule.halfExtents[1] + outerCapsule.radius;

        let centerEulerMatrix = mat3.euler(vec3.radFromDeg(centerBox.angle));
        let centerTransposeMatrix = mat3.transpose(centerEulerMatrix);

        let outerEulerMatrix = mat3.euler(vec3.radFromDeg(outerCapsule.angle));
        let outerTransposeMatrix = mat3.transpose(outerEulerMatrix);

        // Center box to sphere
        let position1 = vec3.subtract(outerCapsule.position, centerBox.position);
        let rotatePosition1 = vec3.transformMat3(centerTransposeMatrix, position1);
        let sdg1 = sdgRoundBox(rotatePosition1, centerBox.halfExtents, centerRadius);
        let distance1 = sdg1.distance, normal1 = sdg1.normal;
        let rotateNormal1 = vec3.transformMat3(centerEulerMatrix, normal1);
        let centerContact = vec3.add(outerCapsule.position, vec3.scale(rotateNormal1,-distance1 - centerRadius));

        // Outer capsule to sphere
        let position2 = vec3.subtract(outerCapsule.position, centerBox.position);
        let rotatePosition2 = vec3.transformMat3(outerTransposeMatrix, position2);
        let sdg2 = sdgRoundBox(rotatePosition2, outerCapsule.halfExtents, outerCapsule.radius + outerRadius);
        let distance2 = sdg2.distance, normal2 = sdg2.normal;
        let rotateNormal2 = vec3.transformMat3(outerEulerMatrix, normal2);
        let outerContact = vec3.add(centerBox.position, vec3.scale(rotateNormal2, distance2 + outerRadius));

        // Green average contact to see if it is closer than position3 or position4
        let averageContact = vec3.scale(vec3.add(outerContact, centerContact), 0.5);

        // Red Contact on center box
        let position3 = vec3.scale(rotateNormal1, distance1 + centerRadius);
        let rotatePosition3 = vec3.transformMat3(outerTransposeMatrix, position3);
        let sdg3 = sdgRoundBox(rotatePosition3, outerCapsule.halfExtents, outerCapsule.radius);
        let distance3 = sdg3.distance, normal3 = sdg3.normal;
        let rotateNormal3 = vec3.transformMat3(outerEulerMatrix, normal3);

        // Blue Contact on outer capsule
        let position4 = vec3.scale(rotateNormal2, distance2 + outerRadius);
        let rotatePosition4 = vec3.transformMat3(centerTransposeMatrix, position4);
        let sdg4 = sdgRoundBox(rotatePosition4, centerBox.halfExtents, 0);
        let distance4 = sdg4.distance, normal4 = sdg4.normal;
        let rotateNormal4 = vec3.transformMat3(centerEulerMatrix, normal4);

        // shape = center box1 to sphere
        // this = outer capsule2 to sphere
        let bestDistance = Infinity;
        let bestNormal = vec3.init();

        // Find the lowest distance number and add the normal
        if (distance3 < distance4)
        {
            bestDistance = distance3;
            bestNormal = rotateNormal3;
        }
        else
        {
            bestDistance = distance4;
            bestNormal = rotateNormal4;
        }

        if (bestDistance <= 0)
        {
            outerCapsule.position = vec3.subtract(outerCapsule.position, vec3.scale(bestNormal, bestDistance));
        }

        this.halfExtents = centerBox.halfExtents;
        // The radius/distance from the outer box to its contact
        this.radius = vec3.dotProduct(bestNormal, vec3.subtract(outerCapsule.position, outerContact));

        // Yellow Minkowski Sum Contact
        this.physicsContacts[0] = outerCapsule.position;
        // Magenta average center of contacts
        this.physicsContacts[1] = averageContact;
        // Red Contact Point for the center Box
        this.physicsContacts[2] = centerContact;
        // Blue Contact Point for the outer Capsule
        this.physicsContacts[3] = outerContact;
    }
}