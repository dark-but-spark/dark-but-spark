#include<bits/stdc++.h>
using namespace std;


// inline double f(double x)
// {
//     return 1.0/((x-1)*(x-1));
// }
inline double f(double x,double y)
{
    return 2*x*y+2*y;
}
inline double y(double x)
{
    return exp(x*x+2*x+log(3));
}
int main()
{
    // while(x+dx<=b+e)
    // {
    //     sum+=dx*.5*(f(x+dx)+f(x));
    //     x=x+dx;
    // }
    // printf("%lf\n",sum);
    // x=a,sum=0;
    // while(x+2*dx<=b+e)
    // {
    //     sum+=(dx/3)*(f(x)+4*f(x+dx)+f(x+2*dx));
    //     x+=2*dx;
    // }
    // printf("%lf",sum);
    double dx=1e-3;
    double x=0,y1=3;

    int n=10000000;
    while(n--)
    {
        y1=y1+f(x,y1)*dx;
        x+=dx;
        printf( "%lf %lf %lf %lf\n",x,y1,y(x),y(x)-y1);

    }
}