#include<bits/stdc++.h>
using namespace std;
const int N=2e5+10;
int n,k;
int a[N];
int sum[N];
int mn[N];
bool check()
{
    sum[n]=mn[n]=a[n];
    for(int i=n-1;i>=1;i--)
    {
        sum[i]=sum[i+1]+a[i];
        mn[i]=min(mn[i+1],sum[i]);
    }
    int s=0;
    for(int i=1;i+2<=n;i++)
    {
        s+=a[i];
        if(s<0) continue;
        if(sum[i+1]-mn[i+2]>=0) return true;
    }
    return false;
}
int mian()
{
    scanf("%d%d",&n,&k);
    for(int i=1;i<=n;i++)
    {
        int x;
        scanf("%d",&x);
        a[i]= x<=k ?1:-1;
    }
    int x=n+1,y=0,s=0;
    for(int i=1;i<=n;i++)
    {
        s+=a[i];
        if(s>=0)
        {
            x=i;
            break;
        }
    }
    s=0;
    for(int i=n;i>=1;i--)
    {
        s+=a[i];
        if(s<=0)
        {
            y=i;
            break;
        }
    }
    if(x+1<y)
    {
        puts("YES");
        return 0;
    }
    if(check())
    {
        puts("YES");
        return 0;
    }
    for(int i=1;i<=n-i+1;i++)
    {
        int t=a[i];
        a[i]=a[n-i+1];
        a[n-i+1]=t;
    }
    if(check())
    {
        puts("YES");
        return 0;
    }
    puts("NO");
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
}