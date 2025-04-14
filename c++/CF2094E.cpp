#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=2e5+10;
int n;
ll a[N];
ll cnt[32];

inline int lowbit(int _)
{
    return _&(-_);
}

void mian() {
    scanf("%d",&n);
    ll mx=0;
    for(int i=0;i<32;i++) cnt[i]=0;
    for(int i=1;i<=n;i++)
    {
        scanf("%lld",&a[i]);
        ll x=a[i];
        while(x)
        {
            ll k=lowbit(x);
            cnt[int(log2(k))]++;
            x-=k;
        }
    }
    for(int i=1;i<=n;i++)
    {
        ll ans=0;
        for(int j=0;j<=30;j++)
        {
            if(a[i]&(1<<j))
            {
                ans+=(n-cnt[j])*(1<<j);
            }
            else
            {
                ans+=cnt[j]*(1<<j);
            }
        }
        // printf("%d ",ans);
        mx=max(mx,ans);
    }
    printf("%lld\n",mx);

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