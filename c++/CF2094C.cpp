#include<bits\stdc++.h>
using namespace std;

const int N=900;
int a[N][N];
int vis[N*2];
int p[N*2];
int n;

void mian()
{
    memset(a,0,sizeof(a));
    memset(vis,0,sizeof(vis));
    memset(p,0,sizeof(p));
    scanf("%d",&n);
    for(int i=1;i<=n;i++)
    {
        for(int j=1;j<=n;j++)
        {
           scanf("%d",&a[i][j]); 
           p[i+j]=a[i][j];
           vis[a[i][j]]=1;
        }
    }
    for(int i=1;i<=2*n;i++)
    {
        if(vis[i]==0)
        {
            p[1]=i;
        }
    }
    for(int i=1;i<=2*n;i++)
    {
        printf("%d ",p[i]);
    }
    puts("");
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