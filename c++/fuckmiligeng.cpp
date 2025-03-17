#include <iostream>
#include <cmath>
using namespace std;
int main()
{
 float q, t, r, u, x, x1, x2,n1,e1;
 float p1 = 981.0,g = 9.80,l = 2.00e-3,b = 8.23e-3,p = 0.101e6,d = 5.00e-3,n = 1.83e-5,e00=1.602e-19;
 cout<<"先输入时间,再输入电压:"<<endl;
 cin >> t>>u;
 r = sqrt(9 * n*l / (2 * p1*g*t));
 x1 = ((n*l) / (t*(1 + b / (p*r))));
 x2 = x1*x1*x1;
 x = sqrt(x2);
 q = 18 * 3.14*x*d / (sqrt(2 * p1*g)*u);
 n1=q/(1.6e-19);
 if(n1-int(n1)>=0.5)
    {
        n1=int(n1)+1;
    }
    else if(n1-int(n1)<0.5||n1-int(n1)>=0)
    {
        n1=int(n1);
    }
    else
    {
        cout<<"error";
    }
    e1=q/n1;
 cout << "半径r=   "<<r <<endl;
 cout<<"电量q=   "<< q<<endl;
 cout<<"油滴所带基本电荷n=   "<<n1<<endl;
 cout<<"实验数据所得电荷量e=   "<<e1<<endl;
 cout<<"实验数据所得误差=   "<<abs(e1-e00)/e00;
 return 0;
}