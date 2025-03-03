#include<bits/stdc++.h>
using namespace std;

const int N=2e5+10;
const int oo=1<<30;
const int L=21;
/*struct node{
    int mx,mn;
    int mxid,mnid;
}tr[N<<4];*/
int mn[L][N],mx[L][N];
int a[N];
int logn[N];
int n;
/*inline int ls(int x)
{
    return x<<1;
}
inline int rs(int x)
{
    return x<<1|1;
}

inline void update(int x)
{
    if(tr[ls(x)].mx>tr[rs(x)].mx) 
    {
        tr[x].mx=tr[ls(x)].mx;
        tr[x].mxid=tr[ls(x)].mxid;
    }
    else
    {
        tr[x].mx=tr[rs(x)].mx;
        tr[x].mxid=tr[rs(x)].mxid;
    }
    if(tr[ls(x)].mn<tr[rs(x)].mn) 
    {
        tr[x].mn=tr[ls(x)].mn;
        tr[x].mnid=tr[ls(x)].mnid;
    }
    else
    {
        tr[x].mn=tr[rs(x)].mn;
        tr[x].mnid=tr[rs(x)].mnid;
    }

}
void build(int x,int l,int r)
{
    if(l==r)
    {
        tr[x].mx=tr[x].mn=a[l];
        tr[x].mxid=tr[x].mnid=l;
        return ;
    }
    int mid=(l+r)>>1;
    build(ls(x),l,mid);
    build(rs(x),mid+1,r);
    update(x);
    return;
}
node select(node _,node __)
{
    node ___;
    if(_.mx>__.mx)
    {
        ___.mx=_.mx;
        ___.mxid=_.mxid;
    }
    else 
    {
        ___.mx=__.mx;
        ___.mxid=__.mxid;
    }
    if(_.mn<__.mn)
    {
        ___.mn=_.mn;
        ___.mnid=_.mnid;
    }
    else 
    {
        ___.mn=__.mn;
        ___.mnid=__.mnid;
    }
    return ___;
}
node find(int x,int l,int r,int nl,int nr)
{
    if(nl<=l&&r<=nr)
    {
        return tr[x];
    }
    int mid=(l+r)>>1;
    node _;
    _.mx=-oo,_.mn=oo;
    _.mnid=_.mxid=0;
    if(nl<=mid)
    {
        _=select(_,find(ls(x),l,mid,nl,nr));
    }
    if(nr>mid)
    {
        _=select(_,find(rs(x),mid+1,r,nl,nr));
    }
    return _;
}
*/
int main()
{
    scanf("%d",&n);
    for(int i=1;i<=n;i++)
    {
        scanf("%d",a+i);
    }
    logn[1]=0;
    logn[2]=1;
    for(int i=3;i<N;i++)
    {
        logn[i]=logn[i/2]+1;
    }
    for(int i=1;i<=n;i++)
    {
        mn[0][i]=mx[0][i]=i;
    }
    for(int j=1;j<L;j++) for(int i=1;i+(1<<j)-1<=n;i++)
    {
        mx[j][i]= a[mx[j-1][i]]>a[mx[j-1][i+(1<<(j-1))]]?
         mx[j-1][i]:mx[j-1][i+(1<<(j-1))];
        mn[j][i]= a[mn[j-1][i]]<a[mn[j-1][i+(1<<(j-1))]]? 
        mn[j-1][i]:mn[j-1][i+(1<<(j-1))];

    }
    
    // build(1,1,n);
    long long sum=0;
    for(int i=1;i<=n;i++) for(int j=i;j<=n;j++)
    {
        int s=logn[j-i+1];
        sum+=abs((a[mx[s][i]]>a[mx[s][j-(1<<s)+1]]? 
                mx[s][i]:mx[s][j-(1<<s)+1])
                -(a[mn[s][i]]<a[mn[s][j-(1<<s)+1]]? 
                mn[s][i]:mn[s][j-(1<<s)+1]));

        // node _=find(1,1,n,i,j);
        // sum+=abs(_.mxid-_.mnid);
    }
    printf("%lld\n",sum);
    return 0;
}