#include<bits\stdc++.h>
using namespace std;
const int N=1e5+10;

int mian()
{
    int n,m,l,r;
    scanf("%d%d%d%d",&n,&m,&l,&r);
    for(int i=m;i<n;i++)
    {
        if(l<0) l++;
        else r--;
    }
    printf("%d %d\n",l,r);
    return 0;
}

int main()
{
    int t;
    scanf("%d",&t);
    while(t--)
    {
        mian();
    }
    return 0;
}