def swap_with_next_larger(num_list):
    result = []
    vis=[0]*len(num_list)
    for num in num_list:
        next_larger=1122233
        id=-1
        for i in range(len(num_list)):
            if num_list[i]>num and vis[i]==0 and num_list[i]<next_larger:
                next_larger=num_list[i]
                id=i
        if id!=-1:
            result.append(num_list[id])
            vis[id]=1
        else:
            result.append(-1)
    return result
num_list=eval(input())
print(swap_with_next_larger(num_list))