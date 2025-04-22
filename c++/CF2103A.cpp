#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=2e5+10;
int n;
int f[N];

void mian() 
{
    memset(f,0,sizeof(f));
    scanf("%d",&n);
    int ans=0;
    for(int i=1;i<=n;i++)
    {
        int x;
        scanf("%d", &x);
        if(f[x]==0)
        {
            f[x]=1;
            ans++;
        }
    }

    printf("%d\n", ans);
}


int main()
{
    int t;
    scanf("%d",&t);
    while(t--)
    {
        mian();
    }
}
