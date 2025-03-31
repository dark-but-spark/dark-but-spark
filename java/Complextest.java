public class Complex 
{
    double re;
    double im;
    public Complex(double re, double im) {
        this.re = re;
        this.im = im;
    }
    public double Re() {
        return re;
    }
    public double Im() {
        return im;
    }
    public Complex add(Complex c) {
        return new Complex(this.re + c.re, this.im + c.im);
    }
    public Complex subtract(Complex c) {
        return this.add(c.multiply(-1));
    }
    public Complex multiply(double k) {
        return new Complex(this.re * k, this.im * k);
    }
    public Complex multiply(Complex c) {
        return new Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re);
    }
    public Complex divide(Complex c) {
        double denominator = c.re * c.re + c.im * c.im;
        return new Complex((this.re * c.re + this.im * c.im) / denominator, (this.im * c.re - this.re * c.im) / denominator);
    }
    public double abs()
    {
        return Math.sqrt(this.re * this.re + this.im * this.im);
    }
}


public class Complextest{

    public static void main(String[] args) {
        
    }
}