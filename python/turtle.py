import turtle

x=10
y=10
r=10
turtle.speed(0)
turtle.penup() 
turtle.goto(x,y+r) 
turtle.color("red","blue") 
turtle.pendown() 
turtle.circle(-r)
turtle.penup()
turtle.goto(x+r,y)
turtle.pendown()
turtle.circle(-r)
turtle.penup()
turtle.goto(x+r,y+r)
turtle.pendown()
turtle.circle(-r)
turtle.penup()
while 1:
    turtle.goto(x+r,y+r)
    turtle.pendown()
    turtle.circle(-r)
    turtle.penup()
    turtle.goto(x+r,y)
    turtle.pendown()
    turtle.circle(-r)
    turtle.penup()
    turtle.goto(x,y+r)
    turtle.pendown()
    turtle.circle(-r)