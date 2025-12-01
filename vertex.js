let GLSLVertexShader = /* glsl */ `#version 300 es
in vec4 a_vertices;

void main(void)
{
	gl_Position = a_vertices;
}`;