"use strict";

function getWebGLContext(canvas)
{
	let context = canvas.getContext("webgl2");

	if (context === null)
	{
		alert("Your browser does not support WebGL 2");
	}
	
	return context;
}

function initShaderProgram(gl, vShader, fShader)
{
	let vertexShader = loadShader(gl, gl.VERTEX_SHADER, vShader);
	let fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fShader);

	if (!vertexShader || !fragmentShader)
	{
		return null;
	}

	let shaderProgram = gl.createProgram();
	
	if (!shaderProgram)
	{
		console.log("Error: cannot create program");
		return null;
	}
	
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
	{
		alert("Error: shader program " + gl.getProgramInfoLog(shaderProgram));
		gl.deleteProgram(shaderProgram);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		return null;
	}
	
	return shaderProgram;
}

function loadShader(gl, type, source)
{
	let shader = gl.createShader(type);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
	{
		if (type == gl.VERTEX_SHADER)
		{
			alert("Error: vertex shader " + gl.getShaderInfoLog(shader));
		}
		else if (type == gl.FRAGMENT_SHADER)
		{
			alert("Error: fragment shader " + gl.getShaderInfoLog(shader));
		}
		
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

/*vec4 sdgBox( in vec3 p, in vec3 b, in float r )
{
    vec3  w = abs(p)-(b-r);
    float g = max(w.x,max(w.y,w.z));
    vec3  q = max(w,0.0);
    float l = length(q);
    vec4  f = (g>0.0)?vec4(l, q/l) :
                      vec4(g, w.x==g?1.0:0.0,
                              w.y==g?1.0:0.0,
                              w.z==g?1.0:0.0);
    return vec4(f.x-r, f.yzw*sign(p));
}*/

function sdgRoundBox(p, halfExtents, radius)
{
    let w = vec3.subtract(vec3.abs(p), halfExtents);
    let g = Math.max(w[0], w[1], w[2]);
    let q = vec3.init(Math.max(w[0], 0), Math.max(w[1], 0), Math.max(w[2], 0));
    let l = vec3.magnitude(q);
    let s = vec3.sign(p);

    if (g > 0)
    {
        return {distance:l - radius, normal:vec3.multiply(vec3.scale(q, 1 / l), s)};
    }
    else
    {
        let normal = [];

        for (let i = 0; i < 3; i++)
        {
            if (w[i] === g)
            {
                normal[i] = 1;
            }
            else
            {
                normal[i] = 0;
            }
        }

        return {distance:g - radius, normal:vec3.multiply(normal, s)};
    }
}

class Common
{
    constructor()
    {
        this.radians = Math.PI / 180.0;
        this.degrees = 180.0 / Math.PI;
    }

    radFromDeg(degrees)
    {
        return degrees * this.radians;
    }

    degFromRad(radians)
    {
        return radians * this.degrees;
    }

    matTranspose(matrix, rows, cols)
    {
        let transposeMatrix = [];
        
        for (let i = 0; i < rows * cols; i++)
        {
            // This needs to be converted to integers
            const row = parseInt(i / rows);
            const col = parseInt(i % rows);
            transposeMatrix[i] = matrix[cols * col + row];
        }
        
        return transposeMatrix;
    }
}

const common = new Common();

class Vec3
{
    constructor()
    {
    }

    init(var1, var2, var3)
    {
        // If all variables are used like vec3.init(1,2,3)
        if (var1 !== undefined && var2 !== undefined && var3 !== undefined)
        {
            return [var1, var2, var3];
        }
        // If there are no variables like vec3.init()
        else if (var1 === undefined)
        {
            return [0,0,0];
        }
        // If a 3 element array is sent in like vec3.init([1,2,3])
        else if (var1.constructor.name === "Array")
        {
            // This copies the vector
            return [var1[0], var1[1], var1[2]];
        }
        // If only one variable is sent in like vec3.init(1.0);
        else
        {
            return [var1, var1, var1];
        }
    }
    
    sign(vector)
    {
        return [
            Math.sign(vector[0]),
            Math.sign(vector[1]),
            Math.sign(vector[2])
        ]
    }

    abs(vector)
    {
        return [
            Math.abs(vector[0]),
            Math.abs(vector[1]),
            Math.abs(vector[2])
        ]
    }

    sumScaleVector(vector1, vector2, scalar)
    {	
        return [
            vector1[0] + vector2[0] * scalar,
            vector1[1] + vector2[1] * scalar,
            vector1[2] + vector2[2] * scalar
        ];
    }

    radFromDeg(vector)
    {
        return [
            vector[0] * common.radians,
            vector[1] * common.radians,
            vector[2] * common.radians
        ];
    }

    scale(vector, scalar)
    {
        return [
            vector[0] * scalar,
            vector[1] * scalar,
            vector[2] * scalar
        ];
    }

    magnitude(vector)
    {
        return Math.sqrt(vec3.dotProduct(vector, vector));
    }

    // For a 3x3 matrix
    transformMat3(matrix, vector)
    {
        return [
            vector[0] * matrix[0] + vector[1] * matrix[3] + vector[2] * matrix[6],
            vector[0] * matrix[1] + vector[1] * matrix[4] + vector[2] * matrix[7],
            vector[0] * matrix[2] + vector[1] * matrix[5] + vector[2] * matrix[8]
        ];
    }

    add(vector1, vector2)
    {
        return [
            vector1[0] + vector2[0],
            vector1[1] + vector2[1],
            vector1[2] + vector2[2]
        ];
    }

    subtract(vector1, vector2)
    {
        return [
            vector1[0] - vector2[0],
            vector1[1] - vector2[1],
            vector1[2] - vector2[2]
        ];
    }

    multiply(vector1, vector2)
    {
        return [
            vector1[0] * vector2[0],
            vector1[1] * vector2[1],
            vector1[2] * vector2[2]
        ];
    }

    dotProduct(vector1, vector2)
    {
        return vector1[0] * vector2[0] + vector1[1] * vector2[1] + vector1[2] * vector2[2];
    }
}

const vec3 = new Vec3();

class Matrix3x3
{
    constructor()
    {
    }

    init(matrix)
    {
        if (matrix === undefined)
        {
            return [
                1,0,0,
                0,1,0,
                0,0,1
            ];
        }
        else
        {
            // Copy values
            const initMatrix = [];
            
            initMatrix[0] = matrix[0];
            initMatrix[1] = matrix[1];
            initMatrix[2] = matrix[2];
            
            initMatrix[3] = matrix[3];
            initMatrix[4] = matrix[4];
            initMatrix[5] = matrix[5];

            initMatrix[6] = matrix[6];
            initMatrix[7] = matrix[7];
            initMatrix[8] = matrix[8];
            
            return initMatrix;
        }
    }

    transpose(matrix)
    {
        return common.matTranspose(matrix, 3, 3);
    }

    euler(radians)
    {
        return this.eulerXYZ(vec3.scale(radians,-1));
    }

    // This matrix uses a Row Major XYZ Euler Matrix
    eulerXYZ(radians)
    {
        let matrix = [];
        
        // XYZ coordinates below
        // X1
        let cos1 = Math.cos(radians[0]);
        let sin1 = Math.sin(radians[0]);
        // Y1
        let cos2 = Math.cos(radians[1]);
        let sin2 = Math.sin(radians[1]);
        // Z2
        let cos3 = Math.cos(radians[2]);
        let sin3 = Math.sin(radians[2]);
        
        // Matrix is cos/sin row Major aka Row|Column 
        matrix[0] = cos2 * cos3; // 11
        matrix[1] = -cos2 * sin3; // 12
        matrix[2] = sin2; // 13

        matrix[3] = cos1 * sin3 + cos3 * sin1 * sin2; // 21
        matrix[4] = cos1 * cos3 - sin1 * sin2 * sin3; // 22
        matrix[5] = -cos2 * sin1; // 23
        
        matrix[6] = sin1 * sin3 - cos1 * cos3 * sin2; // 31
        matrix[7] = cos3 * sin1 + cos1 * sin2 * sin3; // 32
        matrix[8] = cos1 * cos2; // 33
        
        return matrix;
    }
}

const mat3 = new Matrix3x3();
