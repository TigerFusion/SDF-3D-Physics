let GLSLFragmentShader = /* glsl */`#version 300 es
// ************************** Do Not Remove **************************
precision highp float;

uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float iTime;
uniform float iTimeDelta;

// The old gl_FragColor
out vec4 mainFragColor;
// ************************** Do Not Remove **************************

#define MAX_POINTS 4

uniform vec3 u_outerPosition;
uniform vec3 u_outerAngle;
uniform vec3 u_outerHalfExtents;
uniform float u_outerRadius;

uniform vec3 u_centerPosition;
uniform vec3 u_centerAngle;
uniform vec3 u_centerHalfExtents;
uniform float u_centerRadius;

uniform vec3 u_minkowskiHalfExtents;
uniform float u_minkowskiRadius;

uniform vec3 u_physicsContacts[MAX_POINTS];

const int MAX_MARCHING_STEPS = 64;
const float MIN_DISTANCE = 0.0;
const float MAX_DISTANCE = 50.0;
const float PRECISION = 0.001;

const int SHAPE_NULL = 0;
const int SHAPE_SPHERE = 1;
const int SHAPE_BOX = 2;
const int SHAPE_CAPSULE = 3;

// Material Light
const vec3 diffuseColor = vec3(0.6, 0.6, 0.6);
const vec3 specularColor = vec3(1.0);
const float specularIntensity = 3.0;
const float shininess = 128.0;

int outerShape;
int centerShape;

struct Surface
{
	int id;
	float distance;
	vec3 color;
};

Surface opUnion(Surface shape1, Surface shape2)
{
	// The lesser distance should be the output
	if (shape1.distance > shape2.distance)
	{
		return shape2;
	}
	
	return shape1;
}

Surface opSubtract(Surface shape1, Surface shape2)
{
	if (-shape2.distance < shape1.distance)
	{
		return shape1;
	}
	
	shape2.distance = -shape2.distance;
	
	return shape2;
}

Surface opIntersect(Surface shape1, Surface shape2)
{
	// The greater distance should be the output
    if (shape2.distance < shape1.distance)
	{
		return shape1;
	}
	
	return shape2;
}

// Rotates a point theta radians around the x-axis
vec3 xRotate(vec3 p, float theta)
{
	float cost = cos(theta); 
	float sint = sin(theta);
	
	return vec3(p.x, p.y * cost - p.z * sint, p.y * sint + p.z * cost);
}

// Rotates a point theta radians around the y-axis
vec3 yRotate(vec3 p, float theta)
{
	float cost = cos(theta); 
	float sint = sin(theta);
	
	return vec3(p.x * cost + p.z * sint, p.y, - p.x * sint + p.z * cost);
}

// This matrix uses a Row Major XYZ Euler Matrix
mat3 eulerXYZ(vec3 angles)
{
    // XYZ coordinates below
	// X1
	float cos1 = cos(angles.x);
	float sin1 = sin(angles.x);
	// Y1
	float cos2 = cos(angles.y);
	float sin2 = sin(angles.y);
	// Z2
	float cos3 = cos(angles.z);
	float sin3 = sin(angles.z);
	
	// Matrix is cos/sin row Major aka Row|Column 
	return mat3(cos2 * cos3, -cos2 * sin3, sin2,
        cos1 * sin3 + cos3 * sin1 * sin2, cos1 * cos3 - sin1 * sin2 * sin3, -cos2 * sin1,
        sin1 * sin3 - cos1 * cos3 * sin2, cos3 * sin1 + cos1 * sin2 * sin3, cos1 * cos2);
}

// angles in radians
mat3 euler(vec3 angles)
{
    return eulerXYZ(-angles);
}

float sdPlane(vec3 p, vec3 normal, vec3 point)
{
    vec3 vector = p - point;
    float distance = dot(normal, vector);

    return distance;
}

float sdRoundBox(vec3 p, vec3 b, float r)
{
	vec3 q = abs(p) - b;
	return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdSphere(vec3 p, float r)
{
    return length(p) - r;
}

float sdWireSphere(vec3 p, float r, float thickness)
{
    float d = abs(sdPlane(p, vec3(1,0,0), vec3(0))) - thickness;
    d = min(d, abs(sdPlane(p, vec3(0,1,0), vec3(0))) - thickness);
    d = min(d, abs(sdPlane(p, vec3(0,0,1), vec3(0))) - thickness);
    d = max(d, abs(sdSphere(p, r)) - thickness);

    return d;
}

float squareWave(float x, float freq, float amp)
{
	return sign(fract(x * freq) - 0.5) * amp;
}

float sawtoothWave(float x, float freq, float amp)
{
    return (fract(x * freq) - 0.5) * (amp * 2.0);
}

// Scene
Surface scene(vec3 p)
{
    vec3 minkowskiOffset = vec3(-2,0,0);
    vec3 shapeOffset = vec3(3,0,0);

    vec3 blueColor = vec3(0.1, 0.2, 0.5);
    // Color for the collision shapes
    vec3 shapeColor = vec3(squareWave(p.z, 10.0, 0.1)) + blueColor;
    mat3 centerAngle = euler(radians(u_centerAngle));
    mat3 outerAngle = euler(radians(u_outerAngle));

    vec3 minkowskiPosition = p - minkowskiOffset;
    vec3 minkowskiRotate = minkowskiPosition * centerAngle;
    float minkowskiDistance = sdRoundBox(minkowskiRotate, u_minkowskiHalfExtents, u_minkowskiRadius);
    Surface shape = Surface(2, minkowskiDistance, shapeColor);

    // Outer Shape1 for Graphics
    vec3 outerPosition = p - shapeOffset - u_outerPosition;
    vec3 outerRotate = outerPosition * outerAngle;
    float outerDistance = sdRoundBox(outerRotate, u_outerHalfExtents, u_outerRadius);
    shape = opUnion(shape, Surface(2, outerDistance, shapeColor));
    // Wire sphere for debugging
    shape = opUnion(shape, Surface(2, sdWireSphere(outerRotate, length(u_outerHalfExtents) + u_outerRadius, 0.01), vec3(1,1,1)));

    // Center Shape2 for Graphics
    vec3 centerPosition = p - shapeOffset - u_centerPosition;
    vec3 centerRotate = centerPosition * centerAngle;
    float centerDistance = sdRoundBox(centerRotate, u_centerHalfExtents, u_centerRadius);
    shape = opUnion(shape, Surface(2, centerDistance, shapeColor));
    // Wire sphere for debugging
    shape = opUnion(shape, Surface(2, sdWireSphere(centerRotate, length(u_centerHalfExtents) + u_centerRadius, 0.01), vec3(1,1,1)));

    float distance = min(minkowskiDistance, min(outerDistance, centerDistance));
    vec3 floorColor = vec3(1);

    if (distance > 0.05)
    {
        floorColor = sawtoothWave(distance, 5.0, 0.05) + vec3(0, 0.7, 0); // 0,0.8,0
    }

    // Yellow Minkowski Sum Contact
    float contactDistance1 = sdSphere(p - minkowskiOffset - u_physicsContacts[0], 0.1);
    shape = opUnion(shape, Surface(1, contactDistance1, vec3(1,1,0)));
    // Magenta average of the [2] and [3] contacts
    float contactDistance2 = sdSphere(p - shapeOffset - u_physicsContacts[1], 0.1);
    shape = opUnion(shape, Surface(1, contactDistance2, vec3(1,0,1)));
    // Red Contact Point for the center shape
    float contactDistance3 = sdSphere(p - shapeOffset - u_physicsContacts[2], 0.1);
    shape = opUnion(shape, Surface(1, contactDistance3, vec3(1,0,0)));
    // Blue Contact Point for the outer shape
    float contactDistance4 = sdSphere(p - shapeOffset - u_physicsContacts[3], 0.1);
    shape = opUnion(shape, Surface(1, contactDistance4, vec3(0,0,1)));

    // Cyan shows the direction of thrust
    vec3 contactRotate = outerPosition * outerAngle;
    float contactDistance5 = sdSphere(contactRotate - vec3(0,u_outerHalfExtents.y + u_outerRadius,0), 0.15);
    
    shape = opUnion(shape, Surface(1, contactDistance5, vec3(0,1,1)));

	// Create the floor for the scene the vec3s are normal then point
	Surface floor = Surface(1, abs(sdPlane(p, vec3(0,0,-1), vec3(0,0,0))), floorColor);

    return opUnion(shape, floor);
}

Surface raymarch(vec3 ro, vec3 rd)
{
	float depth = MIN_DISTANCE;
	Surface shape;
	
	for (int i = 0; i < MAX_MARCHING_STEPS; i++)
	{
		vec3 p = ro + depth * rd;
		shape = scene(p);
		depth += shape.distance;
		
		if (shape.distance < PRECISION || depth > MAX_DISTANCE)
		{
			break;
		}
	}
	
	shape.distance = depth;
	
	return shape;
}

vec3 createNormal(vec3 p)
{
	const float h = PRECISION;
	const vec2 k = vec2(1,-1);
	
	return normalize(
		k.xyy * scene(p + k.xyy * h).distance +
		k.yyx * scene(p + k.yyx * h).distance +
		k.yxy * scene(p + k.yxy * h).distance +
		k.xxx * scene(p + k.xxx * h).distance);
}

// Phong lighting
vec3 createLight(vec3 p, vec3 rd, vec3 normal, vec3 lightPosition, vec3 color)
{
	// Direction
    vec3 lightDirection = normalize(lightPosition - p);
	
    // diffuse
    float diffuseIntensity = max(dot(lightDirection, normal), 0.0);
    vec3 diffuse = diffuseIntensity * diffuseColor;
    
    // specular
    if (shininess > 0.0)
    {
		vec3 reflectDirection = reflect(lightDirection, normal);  
		float shine = pow(max(dot(rd, reflectDirection), 0.0), shininess);
		vec3 specular = specularIntensity * shine * specularColor;  
	
        return color + (diffuse + specular);
	}
	
    return color + diffuse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
	vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

	// The ro and rd z axises are reversed so that the z axis is like opengl
	vec3 ro = vec3(0, 0, 8); // ray origin
	ro = xRotate(ro,-iMouse.x * 0.01);
    ro = yRotate(ro,-iMouse.y * 0.01); // Rotate the linear motion

	vec3 rd = normalize(vec3(uv,-1)); // ray direction
    rd = xRotate(rd,-iMouse.x * 0.01);
    rd = yRotate(rd,-iMouse.y * 0.01); // Rotate the angular motion

	Surface shape = raymarch(ro, rd);
    
    vec3 backgroundColor = vec3(0.4, 0.7, 0.9);
	vec3 color = vec3(1);

	if (shape.distance > MAX_DISTANCE)
	{
		color = backgroundColor;
	}
	else
	{
		vec3 p = ro + rd * shape.distance;
		vec3 normal = createNormal(p);
		
		// blue shapes
		vec3 lightPosition1 = vec3(-4, 5, 6);

		// id = 1 is the floor and 0.3 is intensity
		if (shape.id == 1)
		{
			color = shape.color;
		}
		else if (shape.id == 2)
		{
		    color *= createLight(p, rd, normal, lightPosition1, shape.color);
		}
    }

	fragColor = vec4(color, 1.0);
}

// ************************** Do Not Remove **************************
void main(void)
{
	mainImage(mainFragColor, gl_FragCoord.xy);
}
// ************************** Do Not Remove **************************`;