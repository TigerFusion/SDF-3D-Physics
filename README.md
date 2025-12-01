# SDF-3D-Physics
This project uses Signed Distance Fields (SDF) for both Graphics (Raymarching) and Physics (Minkowski Sum with contact points).

Physics Approach: Use two SDFs to generate the Minkowski Sum and find a contact. If both physics shapes are not spheres convert one shape to a sphere then test for a contact. Also do the same test for the other shape. For extra help reuse the contacts already generated to find a better normal and depth of the Minkowski Sum.

Graphics Approach: The leftmost shape is the Minkowski Sum which is used for the collision detection. The middle shape is the outer graphics shape and the rightmost shape is the center graphics shape that does not move. The outer and center shapes have white wire spheres to show the radius that generates the contacts.

Keyboard Commands:
ArrowUp = forward motion of the middle shape
ArrowDown = reverse motion of the middle shape
ArrowLeft = left turn of the middle shape
ArrowRight = right turn of the middle shape
q = rotates the rightmost shape left
e = rotates the rightmost shape right
r = reset the the graphics shapes
Spacebar = switches the physics scene
Mouse = moves the green clipping plane

The Good Stuff: 
1) Does not use gradient descent to find the contacts.
2) This example should work with convex and concave SDFs.
3) Uses IQ’s SDF gradient box (https://iquilezles.org/articles/distgradfunctions3d/).

The Bad Stuff:
1) Flat shapes like boxes do not work as well (any ideas would be appreciated).

Shader Project License: MIT License
Created by: Jonathan B.
Website: www.solarfusionsoftware.com

More Cool Stuff I would like to add:
1) Better collision contacts for the box to box collision
2) Add a Cylinder SDF
3) Add a Cone SDF
4) Add a Torus SDF (concave should work)
