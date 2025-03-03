#include<bits/stdc++.h>
using namespace std;

const int N=1e5+10;
int f[N];

inline int isBinary(int x)
{
    while(x)
    {
        if(x%10!=0&&x%10!=1)
            return 0;
        x/=10;
    }
    return 1;
}

int check(int x)
{
    if(f[x]!=-1) return f[x];
    else
    {
        if(isBinary(x))
        {
            return f[x]=1;
        }
        for(int i=2;i*i<=x;i++)
        {
            if(x%i==0)
            {
                if(check(i) and check(x/i))
                {
                    return f[x]=1;
                }
            }
        }
        return f[x]=0;
    }
}

void mian()
{
    int n;
    scanf("%d",&n);
    if(check(n))
    {
        puts("YES");
    }
    else 
    {
        puts("NO");
    }
}

int main()
{
    int t;
    scanf("%d",&t);
    memset(f,-1,sizeof f);
    f[0]=f[1]=1;
    while(t--)
    {
        mian();
    }

    return 0;
}
/*
https://www.luogu.com.cn/problem/CF1950D
https://codeforces.com/problemset/problem/1950/D
*/