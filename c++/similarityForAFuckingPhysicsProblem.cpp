#include <bits/stdc++.h>
using namespace std;
double r = .1;
double den1 = 5e2, den2 = 1.2;
double C = 1.2;
double g = 9.8, pi = 3.1415926;
double h = 10;
double v = 0, t = 0;
double dt = 1e-7, e = 1e-9;
inline double V()
{
    return 4.0 * pi * r * r * r / 3.0;
}
inline double m()
{
    return V() * den1;
}
inline double A()
{
    return pi * r * r;
}
inline double k()
{
    return (.5 * C * den2 * A()) / m();
}
inline double a(double v)
{
    return g - k() * v * v;
}

inline double f(double v)
{
    return log(g - k() * v * v) / (-2.0 * k())+log(g)/(2.0*k());
}
int main()
{
    // freopen("result.out", "w", stdout);
    int cnt=0;
    printf("%lf \n",k());
    while (h>0)
    {
        double dv = a(v) * dt;
        double dx = (v+dv/2.0) * dt;
        v = v + dv;
        t = t + dt;
        h = h - dx;
        cnt=(cnt+1)%10000;
        // if(cnt==0)
        //     printf("%lf %lf\n", 10.0 - f(v), h);
    }
    printf("%lf %lf", v,h);
}