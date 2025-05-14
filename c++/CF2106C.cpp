#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=2e5+10;
int n,k;
int a[N];
int b[N];
inline int check(int x)
{
    if(x<0) return 1e9;
    else return x;
}
void mian() 
{
    scanf("%d",&n);
    scanf("%d",&k);
    for(int i=1;i<=n;i++)
    {
        scanf("%d", &a[i]);
    }
    for(int i=1;i<=n;i++)
    {
        scanf("%d", &b[i]);
    }
    int mx=-1,mn=1e9;
    int sum=0;
    for(int i=1;i<=n;i++)
    {
        if(a[i]==-1||b[i]==-1)
        {
            mx=max(mx,max(a[i],b[i]));
            mn=min(mn,min(check(a[i]),check(b[i])));
        }
        else if(sum==0)
        {
            sum=a[i]+b[i];
        }
        else if(sum!=a[i]+b[i])
        {
            puts("0");
            return;
        }
    }
    if(sum==0)
    {

        ll ans=max(01,mn+k-mx+1);
        ll mmm=ans;
        if(mx==-1)
        {
            ans=1;
        }
        for(int i=1;i<=n;i++)
        {
            if(a[i]==-1&&b[i]==-1)
            {
                ans*=(k+1);
            }
        }
        printf("%lld\n",ans);
        return;
    }
    if(mx>sum||mn+k<sum)
    {
        puts("0");
        return;
    }
    puts("1");

    return;
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
