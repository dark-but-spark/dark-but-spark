from manim import *
import sdl3
class RotateObject(Scene):
    def construct(self):
        textM = Text("Text")
        textC = Text("Reference text")
        textM.shift(UP)
        textM.rotate(PI/4) 
        self.play(Write(textM), Write(textC))
        self.wait(2)
