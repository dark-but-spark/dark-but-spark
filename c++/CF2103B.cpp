#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=2e5+10;
int n;
char s[N];
void mian() 
{
    scanf("%d",&n);
    scanf("%s",s+1);
    s[0]='0';
    int ans=n;
    int cnt=0;
    int fl=0;
    // printf("%s\n", s+1);
    for(int i=0;i<n;i++)
    {
        if(s[i]!=s[i+1])
        {
            ans++;
            cnt++;
        }
    }
    if(cnt==0)
    {
        printf("%d\n", n);
        return;
    }
    else if(cnt==1)
    {
        printf("%d\n",n+1);
        return;
    }
    else if(cnt==2)
    {
        printf("%d\n",n+1);
        return;
    }
    else
    {
        printf("%d\n",ans-2);
        return;
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
}
