#include<bits\stdc++.h>
using namespace std;
const int N=2e5+10;
int a[2][N];
int vis[N];

void mian()
{
    memset(a,0,sizeof(a));
    memset(vis,0,sizeof(vis));
    int n,m,k;
    scanf("%d%d%d",&n,&m,&k);
    int o=1;
    for(int i=1;i<=n;i++)
    {
        for(int j=1;j<=m;j++)
        {

            while(o==a[(i-1)&1][j]||o==a[i&1][j-1]||vis[o]>=m*n/k)
            {
                o=o%k+1;
            }
            printf("%d ",o);
            a[i&1][j]=o;
            vis[o]++;
            o=o%k+1;
        }
        puts("");
    }
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